---
title: "Nginx and ASP.NET Core: Running both, HTTP REST and gRPC services, at once"
slug: nginx-aspnetcore-grpc-rest
subtitle: ""
description: "Running a service that exposes both gRPC and HTTP REST endpoints in ASP.NET Core behind Nginx is not as obvious as it might be. In this post, I do my best to explain how to achieve this without unnecessary pain."

date: 2020-11-15T13:09:12+01:00
lastmod: 2020-11-15T13:58:43+01:00
draft: false
list: true
hiddenFromSearch: false
type: blog

categories: [ "Technology" ]
tags: [ "guide", "dev", "web" ]
series: []
aliases: [ "/blog/nginx-aspnet-grpc-rest" ]

featuredImage: ""
featuredImagePreview: ""
lightgallery: false

code:
  maxShownLines: 30
---

gRPC services are great - they're fast and lightweight. However, for many use cases, REST WebAPI is also desirable. This post explains how to run them both at once.

<!--more-->

## What is gRPC?
Let's start off by talking about what gRPC is. [gRPC](https://grpc.io/) is a fast binary Remote Procedure Call protocol developed by Google. It's really useful especially with service/microservice pattern, as it allows high speed communication between each of the components.  
[ASP.NET Core 3.0](https://docs.microsoft.com/en-gb/aspnet/core/grpc/?view=aspnetcore-3.1) added support for gRPC services through [Grpc.AspNetCore](https://www.nuget.org/packages/Grpc.AspNetCore) package. Other flavours of .NET Core also support it, but in this blog post we focus on ASP.NET Core 3.0 usage.

The main issue with gRPC is that it is not supported by all clients. Prime example that is important for web developers - Postman does not support gRPC, at least as of time of writing this post. Older browsers might also have trouble with it. If these things need to be supported, there are 2 choices - stick to REST API only, or enable support for both. For my Adafruit sensor service, I did want both. Here's how I made sure it works.

## How to make it all work
### Build an ASP.NET Core service
The first step is to get the actual service code. As an example I am going to use parts of code of my AdafruitDHT service, which I might open source and describe at later time. Details of how the service functions is out of scope for this post, some parts were removed for brevity.  
First let's create a new ASP.NET Core WebAPI project. This is a rather simple step, so let's jump into doing actual coding.

#### REST Controller
First let's create an API controller, that does whatever we need (in case of this example - reads AdafruitDHT sensor output) and returns data to the caller. I called it "CoreController".
{{<highlight cs>}}
public class CoreController : ControllerBase
{
    private readonly IAdafruitDhtReader _reader;

    public CoreController(IAdafruitDhtReader reader)
    {
        this._reader = reader;
    }

    [HttpGet]
    public async Task<IActionResult> GetReadingAsync()
    {
        AdafruitDhtOutput output = await _reader.ReadAsync().ConfigureAwait(false);
        if (output.IsSuccess)
        {
            JObject result = new JObject(
                new JProperty("temperatureCelsius", output.TemperatureCelsius),
                new JProperty("temperatureFahrenheit", output.TemperatureFahrenheit),
                new JProperty("temperatureKelvin", output.TemperatureKelvin),
                new JProperty("humidity", output.Humidity)
            );
            return new JsonResult(result);
        }
        return StatusCode(StatusCodes.Status500InternalServerError);
    }
}
{{</highlight>}}

#### gRPC service code
Now let's create a gRPC service .proto file. These files are used to describe the service, and Visual Studio will automatically generate a set of classes to use in C# code.
{{<highlight proto>}}
syntax = "proto3";

service AdafruitDHT {
	rpc Read (AdafruitDhtGrpcRequest) returns (AdafruitDhtGrpcResponse);
}

message AdafruitDhtGrpcRequest {
}

message AdafruitDhtGrpcResponse {
	float temperatureCelsius = 1;
	float temperatureFahrenheit = 2;
	float temperatureKelvin = 3;
	float humidity = 4;
}
{{</highlight>}}

I also changed the .proto file properties a bit - I set value of "gRPC Stub Classes" to `Server only`, as the service does not need client classes generated - this however is fully optional.

The gRPC service needs an actual C# service class too, so let's create it next to our .proto file. The service class needs to inherit from a class `AdafruitDHT.AdafruitDHTBase` that Visual Studio generated from the .proto file. If it doesn't exist, since rebuild the project to trigger class generation.  
The actual service code is very similar to REST Controller code - we want to keep functionality the same, after all.
{{<highlight cs>}}
public class AdafruitDhtGrpc : AdafruitDHT.AdafruitDHTBase
{
    private readonly IAdafruitDhtReader _reader;

    public AdafruitDhtGrpcV1(IAdafruitDhtReader reader)
    {
        this._reader = reader;
    }

    public override async Task<AdafruitDhtGrpcResponse> Read(AdafruitDhtGrpcRequest request, ServerCallContext context)
    {
        AdafruitDhtOutput output = await _reader.ReadAsync(context.CancellationToken).ConfigureAwait(false);
        if (output.IsSuccess)
            return new AdafruitDhtGrpcResponse()
            {
                TemperatureCelsius = output.TemperatureCelsius,
                TemperatureFahrenheit = output.TemperatureFahrenheit,
                TemperatureKelvin = output.TemperatureKelvin,
                Humidity = output.Humidity
            };
        }
        throw new RpcException(new Status(StatusCode.Internal, "All attempts to read the sensor failed"));
    }
}
{{</highlight>}}

There are a few differences:
- We use `override` keyword for Read method. This is because we want to override the method created inside of `AdafruitDHT.AdafruitDHTBase`.
- Instead of returning JSON object as a HTTP result, we return `AdafruitDhtGrpcResponse` - this type is also generated by Visual Studio from the .proto file.
- Instead of returning a HTTP error status code, we throw a RpcException. This will let gRPC stack handle it correctly.

{{<admonition type=info title="Tip">}}
There is also a less manual way to do it, using [Microsoft.AspNetCore.Grpc.HttpApi](https://www.nuget.org/packages/Microsoft.AspNetCore.Grpc.HttpApi) package, as described on [Microsoft Docs](https://docs.microsoft.com/en-us/aspnet/core/grpc/httpapi?view=aspnetcore-3.0). This however is an experimental project, and there is currently no commitment to it from Microsoft - at such, it might be not stable and it might not work at all.
{{</admonition>}}

#### Enabling it all
Now we just need to enable it in _Startup.cs_. Add following lines in `ConfigureServices`:
{{<highlight cs>}}
// enable REST API controllers, with Netwonsoft.JSON support
services.AddControllers().AddNewtonsoftJson();
// enable gRPC service
services.AddGrpc(options => options.EnableDetailedErrors = false)
    .AddServiceOptions<AdafruitDhtGrpc>(options => options.MaxReceiveMessageSize = 512 /*0.5kb*/);
{{</highlight>}}

We also need to enable middlewares in `Configure` method:
{{<highlight cs>}}
app.UseRouting();

app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
    endpoints.MapGrpcService<AdafruitDhtGrpc>();
});
{{</highlight>}}

This should cover website code itself. Now we need to ensure that both work with Nginx.

### Update Nginx
I personally use Nginx as reverse proxy. It's highly configurable, lightweight, and multiplatform, which makes it perfect for use with services.  
Nginx supports gRPC [since version 1.13.10](https://www.nginx.com/blog/nginx-1-13-10-grpc/). As long as you have that version or higher, you're good to go.  
If your version is lower, you need to update it using your package manager. Here is an example of upgrading on debian-based Linux systems.
{{<highlight bash>}}
sudo apt update
sudo apt upgrade nginx -y
{{</highlight>}}

{{<admonition type=warning title="Updating on a Raspberry Pi">}}
I personally use Raspberry Pis to host my personal use-stuff like personal services or Discord bots. Raspberry Pi is great for this.  
However, I failed to find a way to update Nginx to required versions on Raspbian Stretch. Raspbian Buster was required for me to get a painless update.

If you use Raspbian Stretch and don't want to do a full reinstall, you can upgrade to Buster using instructions found on [PiMyLifeUp.com](https://pimylifeup.com/upgrade-raspbian-stretch-to-raspbian-buster/).  
Upgrading may take a longer while - so go make a tea, eat a dinner, watch [iZombie on Netflix](https://www.netflix.com/pl-en/title/80027159) or something. Just make sure to check on upgrade once in a while - there may be a few prompts for your action.
{{</admonition>}}

### Configure Nginx
Now we need to configure Nginx server to proxy to your service. Web API part is simple. Open default site (or other site if you use multiple config files) in your favourite text editor - I personally use leafpad: 
{{<highlight bash>}}
sudo leafpad /etc/nginx/sites-available/default
{{</highlight>}}

Add a new server snippet as follows:
{{<highlight nginx>}}
server {
    listen 	7231;
    server_name	localhost;

    location / {
	    set $upstream 		127.0.0.1;
	    proxy_pass		    http://$upstream:7331;      
	    proxy_http_version 	1.1;
	    proxy_set_header	Upgrade $http_upgrade;
	    proxy_set_header	Connection keep-alive;
	    proxy_set_header	Host $http_host;
	    proxy_set_header	X-Frowarded-For $proxy_add_x_forwarded_for;
	    proxy_set_header	X-Forwarded-Proto $scheme;
	    proxy_cache_bypass	$http_upgrade;
    }
}
{{</highlight>}}

All great and easy, right? Well, almost. This will work for HTTP REST WebAPI, but it will not work for gRPC, as it requires HTTP/2. Adding a `http2` directive could help, if not for the second issue - Nginx does not allow using gRPC on the same port. Bummer.  
Thankfully it's rather easy to work around. We simply need to add a second server directive. Just add it right below the one we added just a moment ago, in the same file:
{{<highlight nginx "linenostart=18,hl_lines=6">}}
server {
    listen	7232 http2;
    server_name	localhost;

    location / {
	    grpc_pass		   grpc://127.0.0.1:7332;
    }
}
{{</highlight>}}

Now Nginx is properly configured. But there's a bit more we need to do.

### Configure Kestrel
If you set up TLS/SSL properly, default configuration should work just fine, and if you're going to open the service to public internet, you absolutely should set it up. If that's the case, feel free to skip this step.  
However, if you want to use the service only locally, within LAN or your own VPN (like me), setting up TLS/SSL is more effort than it's worth. But this means that Kestrel will reject connections, as without TLS, [it needs to be set up to HTTP/2 only](https://docs.microsoft.com/en-gb/aspnet/core/grpc/aspnetcore?view=aspnetcore-3.1&tabs=visual-studio#protocol-negotiation) on that port.

Thankfully, it's really easy to work around. Open up your `appsettings.json`, and add following section:
{{<highlight json>}}
"Kestrel": {
  "Endpoints": {
    "http": {
      "Url": "http://localhost:7331"
    },
    "Grpc": {
      "Url": "http://localhost:7332",
      "Protocols": "Http2"
    }
  }
}
{{</highlight>}}

This small configuration snippet will keep HTTP port support both HTTP/1 and HTTP/2, while enforcing HTTP/2 on gRPC port.  
With this done, you should be good to go!

## Test it!


### Testing REST WebAPI endpoint
This step is easy. To test it, we publish the project, deploy it on our Raspberry Pi host, and run it: 
{{<highlight bash>}}
dotnet ProjectName.dll
{{</highlight>}}
Now you can use any of the HTTP testing tools, such as Postman or curl. Simply make a GET request to the service on HTTP port (as configured in Nginx), and you should get some output.
{{<image src="OutputRest.png" alt="REST WebAPI Output" title="REST WebAPI Output" caption="Output of REST WebAPI request using Postman">}}

### Testing gRPC service
This step is rather more complicated. You could write [your own client](https://docs.microsoft.com/en-us/aspnet/core/grpc/client?view=aspnetcore-3.0), and likely you'll do it sooner or later - after all, creating a gRPC service would be pretty pointless without something that would actually use it. However, that's a lot of work just for a test. The choice of testing tools is quite limited for now, and these that are available require reflection service to be added - but it's a much easier approach to go with.

#### Enabling gRPC reflection
 To use a gRPC testing tool, first install [Grpc.AspNetCore.Server.Reflection](https://www.nuget.org/packages/Grpc.AspNetCore.Server.Reflection/) package.  
Once the package is installed, we need to make 2 small changes to our **_Startup.cs_**. First, add following line to `ConfigureServices` method:
{{<highlight cs>}}
// enable gRPC reflection
services.AddGrpcReflection();
{{</highlight>}}

Next, in `Configure` method, add a new endpoint for reflection service:
{{<highlight cs "hl_lines=6-7">}}
app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
    endpoints.MapGrpcService<AdafruitDhtGrpc>();

    if (env.IsDevelopment())
        endpoints.MapGrpcReflectionService();
});
{{</highlight>}}

That's all the code changes we need - build, deploy and run - make sure to run as Development environment so the Reflection Service endpoints are mapped: 
{{<highlight bash>}}
dotnet ProjectName.dll --Environment=Development
{{</highlight>}}

#### Installing a testing tool
Microsoft [lists a few tools to test gRPC with](https://docs.microsoft.com/en-gb/aspnet/core/grpc/test-tools?view=aspnetcore-3.0) - you can use whichever you prefer, but I personally chose [gRPCui](https://docs.microsoft.com/en-gb/aspnet/core/grpc/test-tools?view=aspnetcore-3.0#about-grpcui).  
The suggested way is to install is using [Go Tool](https://golang.org/). Once you have Go installed, just run 2 commands to install gRPCui:
{{<highlight powershell>}}
go get github.com/fullstorydev/grpcui/...
go install github.com/fullstorydev/grpcui/cmd/grpcui
{{</highlight>}}
{{<admonition type=question title="Help with gRPCui">}}
For more info about gRPCui, visit the tool's [GitHub Repository](https://github.com/fullstorydev/grpcui).
{{</admonition>}}

#### Performing the test (finally!)
Now it's time to finally run the tool. You need to specify the address of the service and port. I connect to my Raspberry Pi over VPN, so my command looks as follows:
{{<highlight powershell>}}
grpcui -plaintext 10.11.1.121:7232
{{</highlight>}}
{{<admonition type=note title="Note">}}
If you set up TLS/SSL support in Nginx, skip the `-plaintext` flag in your command.
{{</admonition>}}

If everything is okay, your browser should open up a new website on localhost. There you can select service and method name, and then press `Invoke` button. Once you do, you should get output displayed for you.
{{<image src="OutputGrpc.png" alt="gRPC Service Output" title="gRPC Service Output" caption="Output of gRPC service request using gRPCui">}}


## Summary
Setting up a service behind Nginx that supports both HTTP/1 REST WebAPI and gRPC service requires some effort, but as I explained in this post, it's perfectly doable. Once you overcome the initial struggles, you can add more gRPC services to your ASP.NET Core project, and enjoy benefits of both - performance of gRPC where it's supported, and availability of HTTP/1 REST WebAPI where it's not!