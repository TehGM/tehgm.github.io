---
title: "TehGM's C# Utilities v0.2.0"
slug: tehgm-csharp-utilities-v0-2-0
subtitle: ""
description: "Service lifetime-agnostic SemaphoreSlims, string randomization, JSON.NET support for UniqueIDs and more! Check out what was added to TehGM.Utilities library in version 0.2.0."

date: 2022-12-17T23:52:04+01:00
lastmod: 2022-12-17T23:52:04+01:00
draft: false
list: true
hiddenFromSearch: false
type: blog

categories: [ "Technology" ]
tags: [ "guide", "dev" ]
series: []
aliases: []

featuredImage: ""
featuredImagePreview: ""

code:
  maxShownLines: 30
---

<!--more-->

Some time ago I released [version 0.1.0]({{<ref "/blog/other/stalker-anomaly-modpack.md">}}) of my [TehGM.Utilities library](https://www.nuget.org/packages/TehGM.Utilities) to reduce the amount of boilerplate code in my projects. Since then I added some features, but they were so minor so they weren't worthy a new release IMO.

Meanwhile I worked on some of my other projects, and developed some snippets that I must say are quite useful in some scenarios. Yesterday I randomly bought `stalcraftclan.com` and figured I better get started with making an actual use of it, so I created a new project. And there are some things I want to import there, so decided it's time for another release!

This release might still be small, and more useful stuff is definitely coming in future, but it still includes some nifty thingies.

## What is TehGM's C# Utilities
TehGM's C# Utilities is the unimaginative name I gave to a set of libraries that contain code that I kept reusing over and over again. They're designed for my own purposes, but each of them is quite lightweight and universal, so I imagine virtually anyone could make use of them.

Most of the libraries are available on [nuget.org](https://www.nuget.org/packages/TehGM.Utilities), and they're wrapped by one metapackage for easy installation.
{{<highlight bash>}}
dotnet add package TehGM.Utilities
{{</highlight>}}

For ASP.NET Core projects, you can also add ASP.NET Core library:
{{<highlight bash>}}
dotnet add package TehGM.Utilities.AspNetCore
{{</highlight>}}

But since under the hood it's just a set of small libraries, you can install each individually if you want to. This might be helpful for example when using Blazor WASM.
{{<highlight bash>}}
dotnet add package TehGM.Utilities.UniqueIDs
dotnet add package TehGM.Utilities.Logging
dotnet add package TehGM.Utilities.Randomization
dotnet add package TehGM.Utilities.Time
dotnet add package TehGM.Utilities.Validation
dotnet add package TehGM.Utilities.Threading
dotnet add package TehGM.Utilities.AspNetCore
{{</highlight>}}

### JSON.NET Support
There are additional packages that need to be installed separately to be used, and they're JSON.NET support packages. Well, just one currently, but in future it is likely that there will be more.

The reason for this is simple - unless JSON.NET becomes a big part of `TehGM.Utilities`, I don't want to introduce yet another dependency when it's not needed. This might matter for things like Blazor WASM.

If you do use JSON.NET, just add additional packages depending on your requirements.
{{<highlight bash>}}
dotnet add package TehGM.Utilities.Time.JsonNet
dotnet add package TehGM.Utilities.UniqueIDs.JsonNet
{{</highlight>}}

{{<admonition type=warning title="JSON.NET Vulnerability">}}
A [severe vulnerability](https://github.com/advisories/GHSA-5crp-9r3c-p9vr) was found in JSON.NET before version 13.0.1.

My package depends on JSON.NET 11.0.1 or greater. This is purely for compatibility, but you should manually install [Newtonsoft.Json version 13.0.1](https://www.nuget.org/packages/Newtonsoft.Json/) or greater.
{{</admonition>}}

### Version v0.2.0
This package is released as version v0.2.0. This is because it's very small now, and as I expand it, I might notice I could've structured many things better. This could very likely lead to breaking changes.

By using version lower than v1.0.0, I give myself the comfort of being able to change anything without officially worrying about backwards compatibility.  
Of course it means that potential consumers of the library need to be more careful with updating - but hopefully I won't break stuff too much!

### Open Source
This project is entirely open source - go check it out!

https://github.com/TehGM/TehGM.Utilities

## What's new in Version v0.2.0
Okay, that's all cool. But what utilities are offered in the first release?

### Random Strings
`IRandomizer` has been in added to TehGM's C# Utilities in version 0.1.0, and it pretty much functions the same - but it now has a new extension: `GetRandomString`.  
This extension will use the `IRandomizer` to generate a random string of your requested length.
{{<highlight csharp>}}
string randomString = _randomizer.GetRandomString(10);
Console.WriteLine(randomString);        // I got "DiPBn9Bbdq" in my unit test
{{</highlight>}}

By default it'll only use lowercase and uppercase letters A-Z as well as digits 0-9. However if you wish to change this, you can provide your own charset string.
{{<highlight csharp>}}
string charset = "aB3";
string randomString = _randomizer.GetRandomString(10, charset);
Console.WriteLine(randomString);        // I got "a3a3a3BaB3" in my unit test
{{</highlight>}}

{{<admonition type=tip title="Character Chance">}}
Each character in charset gets the same chance to be chosen. However, the charset is not validated for each character being unique - so if you want a specific character to have more chance to appear in your string, you can pass it in the charset multiple times.  
For example: if charset is `aaabc`, the character `a` will have triple chance to appear in the result string!
{{</admonition>}}

### System.Random extensions
`IRandomizer` and `RandomizerService` exist mainly so it's easy to use them with Dependency Injection. They can still be used without DI, of course, but what if you *really* want (or have to) use C#'s [Random](https://learn.microsoft.com/en-gb/dotnet/api/system.random?view=net-7.0) class?

Well, v0.2.0 of the library adds some extensions for `Random` class to `TehGM.Utilities.Randomization` namespace. Now you can use most of the handy `IRandomizer`'s methods with your old trusty `Random`!

{{<highlight csharp>}}
using TehGM.Utilities.Randomization;

Random random = new Random();

double randomChance = random.GetRandomChance();
bool didIWin = random.RollChance(0.2);
MyThing myRandomThing = random.GetRandomValue(new MyThing[] { /* ... */ });
MyEnum randomEnumValue = random.GetRandomEnumValue<MyEnum>();
string randomString = random.GetRandomString(10);
{{</highlight>}}

### ILockProvider
C# has a [SemaphoreSlim](https://learn.microsoft.com/en-gb/dotnet/api/system.threading.semaphoreslim?view=net-7.0) class which is really useful for locking async code. For many scenarios it will work well enough.  
But what if you have some services with Transient or Scoped lifetimes, but still want to await a single semaphore across them all? Well, it gets problematic.

You could technically make~the semaphore `static`, but it doesn't play nice with service-oriented Dependency Injection.  
That's why I created a `ILockProvider<T>` interface and `LockProvider<T>` class. They live in a new **TehGM.Utilities.Threading** package.

The way this works - `ILockProvider<T>` contains a shared `SemaphoreSlim`, and it is registered as a singleton service within DI container. This means that you can inject it into any service and have an effectively "static" `SemaphoreSlim`, so it'll be shared by all of your your services, even if they're registered with Transient or Scoped lifetimes.  
The `T` generic parameter is used to differentiate between the caller service - this way `MyServiceA` and `MyServiceB` won't deadlock, as they do not share the lock!

To use this service, first register it with open generics:
{{<highlight csharp>}}
services.AddSingleton(typeof(ILockProvider<>), typeof(LockProvider<>));
{{</highlight>}}

Now you can inject it to your service (note that constructor uses `MyService` as a generic parameter):
{{<highlight csharp>}}
public class MyService
{
    private readonly ILockProvider _lock;

    public MyService(ILockProvider<MyService> lockProvider)
    {
        _lock = lockProvider;
    }
}
{{</highlight>}}

And now you can use your `_lock` just like you would use a normal SemaphoreSlim:
{{<highlight csharp>}}
public async Task DoSomethingAsync(CancellationToken cancellationToken = default)
{
    await _lock.WaitAsync(cancellationToken);
    try
    {
        // do your stuff
    }
    finally
    {
        _lock.Release();    // don't forget to release!
    }
}
{{</highlight>}}

### JSON.NET support for Base64Guid
Version 0.1.0 added a `Base64Guid` struct which is used to represent a GUID in a shorter Base64 format.  
Version 0.2.0 adds a JSON.NET support, much like Time utilities had it before.

To begin, install the new JsonNet compatibility package:
{{<highlight bash>}}
dotnet add package TehGM.Utilities.UniqueIDs.JsonNet
{{</highlight>}}

Now you can mark all your `Base64Guid`s with a JsonConverter attribute, so JSON.NET knows how to handle them:
{{<highlight csharp>}}
[JsonConverter(typeof(Base64GuidConverter))]
public Base64Guid ID { get; set; } 
{{</highlight>}}

### Additional route constraints for ASP.NET Core
ASP.NET Core has a concept of [route constraints](https://learn.microsoft.com/en-gb/aspnet/core/fundamentals/routing?view=aspnetcore-7.0#route-constraints) so you can tell that something in URL has to be, say, an `int`. However the framework doesn't automatically include constraints for some less used types like `uint`. However I decided I need them in one of my projects (I needed `ulong` specifically), so I decided to add them.

Version 0.2.0 adds a new [TehGM.Utilities.AspNetCore](https://www.nuget.org/packages/TehGM.Utilities.AspNetCore) package which includes a set of 6 new constraints for `byte`, `sbyte`, `short`, `uint`, `ulong` and `ushort`.  
This package is not included when you just install [TehGM.Utilities](https://www.nuget.org/packages/TehGM.Utilities) metapackage to avoid unnecessary dependencies in your project, so you have to install it manually:
{{<highlight bash>}}
dotnet add package TehGM.Utilities.AspNetCore
{{</highlight>}}

Once installed, you should configure routing services to recognize the new constraints. Here's a snippet that will add all 6:
{{<highlight csharp>}}
services.AddRouting(options => 
{
	options.ConstraintMap.Add("byte", typeof(TehGM.Utilities.AspNetCore.Routing.Constraints.ByteRouteConstraint));
	options.ConstraintMap.Add("sbyte", typeof(TehGM.Utilities.AspNetCore.Routing.Constraints.SbyteRouteConstraint));
	options.ConstraintMap.Add("short", typeof(TehGM.Utilities.AspNetCore.Routing.Constraints.ShortRouteConstraint));
	options.ConstraintMap.Add("uint", typeof(TehGM.Utilities.AspNetCore.Routing.Constraints.UintRouteConstraint));
	options.ConstraintMap.Add("ulong", typeof(TehGM.Utilities.AspNetCore.Routing.Constraints.UlongRouteConstraint));
	options.ConstraintMap.Add("ushort", typeof(TehGM.Utilities.AspNetCore.Routing.Constraints.UshortRouteConstraint));
});
{{</highlight>}}

Now you can simply use your constraints in your URLs. Here's an example for an API Controller:
{{<highlight csharp>}}
[Route("api/discord")]
[ApiController]
public class DiscordController : ControllerBase
{
    [HttpGet("user/{id:ulong}")]
    public async Task<IActionResult> GetUserAsync(ulong id)
    {
        // do your stuff
    }
}
{{</highlight>}}


## That's STILL not a lot
Yeah yeah, I know.

But that's okay. I'll slowly keep adding stuff over time as I develop my other projects. I do already have some more additions planned, but I still haven't decided how to exactly librar-ise them. All in due time!