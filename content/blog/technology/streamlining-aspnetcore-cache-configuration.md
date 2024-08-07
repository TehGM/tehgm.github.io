---
title: "Streamlining ASP.NET Core Cache Configuration"
slug: streamlining-aspnetcore-cache-configuration
subtitle: ""
description: "Caching in web is super important for performance, and ASP.NET Core supports it out of the box - however configuring it the documented way can result in a lot of mess. Today we look how to make it cleaner without sacrificing any features."

date: 2023-08-27 16:36:06+01:00
lastmod: 2023-08-27 20:14:06+01:00
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
  maxShownLines: 100
---

<!--more-->

ASP.NET Core supports response caching configuration - I mean, it's a web server, so it makes sense. Unfortunately the way to configure it that was foreseen by Microsoft is... well, completely shoddy. That among just-as-shoddy auth mechanisms was one of my bigger gripes with ASP.NET Core. Today I decided to clean that up in my project.

## The Problem
With the way Microsoft [suggests to](https://learn.microsoft.com/en-us/aspnet/core/performance/caching/response?view=aspnetcore-7.0#cache-profiles) configure cache profiles, you end up polluting your Program.cs with tens or even hundreds of lines like this:
{{<highlight cs>}}
services.AddControllersWithViews(options =>
{
    options.CacheProfiles.Add(CacheProfileNames.ClansStatistics,
        new CacheProfile()
        {
            Duration = 60 * 15,
            VaryByQueryKeys = new[] { "region", "faction", "historyDays" }
        });

    // ... Add dozens more like that here ...
})
    .AddNewtonsoftJson();
{{</highlight>}}

`CacheProfileNames` in this context just a static class that contains all names as constant strings, cause Microsoft for some reason likes to make everything (caching, auth) depend on strings.

Naturally I was super unhappy with that mess.

And I got even more unhappy today when I noticed that there are 2 types of caching config - [Response Caching](https://learn.microsoft.com/en-us/aspnet/core/performance/caching/response?view=aspnetcore-7.0) which tells browsers and proxies how to cache responses, and also [Output Caching](https://learn.microsoft.com/en-us/aspnet/core/performance/caching/output?view=aspnetcore-7.0) which is edge (in your server memory) caching introduced in .NET 7.  
**Output Caching** is more feature-rich and doesn't allow browsers to bypass cache, but... it doesn't tell them to cache content either!

That'd mean if we wanted both mechanisms at once, we need duplicated configuration with how Microsoft has documented it!  
*What the hell*. On that spot I decided to *finally* sort this mess in my project.

## The Solution
The idea to clean this up is to define something that can represent configuration both cache types, and also is easy to add without polluting Program.cs too much. Thankfully I have handled stuff like that multiple times in past (mainly for MongoDB), so it wasn't hard to get started.

Let's break the solution down.

### Step 1: Base Class
The first step is to create some form of abstraction.  
Interface would work fine, but to make the solution even more slim, I went with a base class like this:

{{<highlight cs>}}
using Microsoft.AspNetCore.Mvc;

public abstract class ResponseCacheProfileBase
{
    public string ProfileName { get; }
    public TimeSpan Duration { get; }
    public ResponseCacheLocation Location { get; }
    public string[] VaryByQueryKeys { get; init; }
    public string VaryByHeader { get; init; }
    public IEnumerable<Type> Policies { get; init; }

    public bool IsNoCache => this.Duration < TimeSpan.Zero || this.Location == ResponseCacheLocation.None;

    public ResponseCacheProfileBase(string name, TimeSpan duration, ResponseCacheLocation location)
    {
        if (string.IsNullOrEmpty(name)) 
            throw new ArgumentNullException(nameof(name));

        this.ProfileName = name;
        this.Duration = duration;
        this.Location = location;
    }
}
{{</highlight>}}
This class is a bit self-explanatory - has a few properties that are used in **Response Cache** configuration, a profile name to distinct it by, and also a helper `IsNoCache` property to determine if this profile disables cache. There's also collection of `Type` - there we can add any custom `IOutputCachePolicy` policy type we implement.

### Step 2: The Profiles
Now let's convert actual profiles into the new approach.

We do this by creating a new class for each cache profile previously defined in Program.cs. Using the same example as before, we create a new class for Clans Statistics:
{{<highlight cs>}}
using Microsoft.AspNetCore.Mvc;

public class ClansStatisticsCacheProfile : ResponseCacheProfileBase
{
    public const string Name = "ClansStatistics";

    public ClansStatisticsCacheProfile()
        : base(Name, TimeSpan.FromMinutes(15), ResponseCacheLocation.Any)
    {
        base.VaryByQueryKeys = new[] { "region", "faction", "historyDays" };
    }
}
{{</highlight>}}

As you can see, the profile class is very slim - it calls the base constructor for the common properties (name, duration and location). Any less common (with `init` setter) property simply gets set in the constructor body.

One additional thing is the constant string `Name` - it gets passed to base constructor as-is, but the real reason it's defined as const string is to make it possible to use it in any of the ASP.NET Core's attributes. This effectively means we can delete the old `CacheProfileNames` class.

Another example profile that can be useful would be no cache profile:
{{<highlight cs>}}
using Microsoft.AspNetCore.Mvc;

public class NoCacheProfile : ResponseCacheProfileBase
{
    public const string Name = "NoCache";

    public NoCacheProfile()
        : base(Name, TimeSpan.Zero, ResponseCacheLocation.None) { }
}
{{</highlight>}}

### Step 3: Automatic Registration
Now we have a set of small self-contained classes for each profile, but they don't do anything yet. We now need to create a small extension class to register the profiles with ASP.NET Core.

{{<highlight cs>}}
using Microsoft.AspNetCore.Mvc;
using System.Runtime.CompilerServices;

namespace Microsoft.Extensions.DependencyInjection;

public static class ResponseCachingServiceCollectionExtensions
{
    public static IServiceCollection AddCustomResponseCaching(this IServiceCollection services)
    {
        if (services == null)
            throw new ArgumentNullException(nameof(services));

        IEnumerable<ResponseCacheProfileBase> profiles = FindDefinedProfiles();

        services.Configure<MvcOptions>(options =>
        {
            foreach (ResponseCacheProfileBase profile in profiles)
            {
                options.CacheProfiles.Add(profile.ProfileName, new CacheProfile()
                {
                    Duration = (int)profile.Duration.TotalSeconds,
                    Location = profile.Location,
                    NoStore = profile.IsNoCache,
                    
                    // NOTE: these 2 lines are commented because we'll remove ResponseCaching middleware
                    // see "Should we keep both attributes?" below
                    // uncomment these 2 lines if you're going to use ResponseCaching middleware in your project

                    //VaryByHeader = profile.VaryByHeader,
                    //VaryByQueryKeys = profile.VaryByQueryKeys
                });
            }
        });

        services.AddOutputCache(options =>
        {
            options.DefaultExpirationTimeSpan = TimeSpan.Zero;
            options.UseCaseSensitivePaths = false;

            foreach (ResponseCacheProfileBase profile in profiles)
            {
                options.AddPolicy(profile.ProfileName, builder =>
                {
                    if (profile.IsNoCache)
                        builder.NoCache();
                    else
                    {
                        builder.Cache();
                        if (profile.Duration > TimeSpan.Zero)
                            builder.Expire(profile.Duration);
                        if (!string.IsNullOrWhiteSpace(profile.VaryByHeader))
                            builder.SetVaryByHeader(profile.VaryByHeader);
                        if (profile.VaryByQueryKeys?.Any() == true)
                            builder.SetVaryByQuery(profile.VaryByQueryKeys);

                        foreach (Type policy in profile.Policies ?? Enumerable.Empty<Type>())
                            builder.AddPolicy(policy);
                    }
                });
            }
        });

        return services;
    }

    private static IEnumerable<ResponseCacheProfileBase> FindDefinedProfiles()
    {
        return typeof(Program).Assembly.GetTypes()
            .Where(t 
                => !t.IsAbstract 
                && !t.IsGenericType
                && !Attribute.IsDefined(t, typeof(CompilerGeneratedAttribute))
                && typeof(ResponseCacheProfileBase).IsAssignableFrom(t))
            .Select(t => Activator.CreateInstance(t))
            .Cast<ResponseCacheProfileBase>();
    }
}
{{</highlight>}}

Now there's a little to unpack.

First, we use our `FindDefinedProfiles()` method to find all of our profiles. The method uses some reflection to find all our classes that inherit from `ResponseCacheProfileBase`, but also excludes any abstract, generic and compiler-generated classes to spare us some issues. Then it initializes each of these profiles using its parameter-less constructor. Finally it casts them to our base type `ResponseCacheProfileBase` and returns the result.

Next, we convert each of our own profiles to **Response Caching** profile. We do this by configuring `MvcOptions` - you could register controllers etc here instead, but I do it that way as my project assumes to have it done already - it still wouldn't hurt, but it's just a design choice.

And lastly, we convert each of our profiles to **Output Caching** policy. The idea is similar as with previous step, however the API differs slightly, so we have to do it a bit differently. Additionally we configure some defaults for caching as well.

With this extension defined, we can trim our Program.cs - instead of tens or hundreds of lines, we can now trim it to just 2:
{{<highlight cs>}}
services.AddControllersWithViews().AddNewtonsoftJson();
services.AddCustomResponseCaching();
{{</highlight>}}

### Step 4: Convert Existing attributes
If we used attributes in our controllers, we need to change them slightly as we deleted our `CacheProfileNames` - however it's very easy.

Simply put - instead of using `CacheProfileNames.ClansStatistics` in the attribute, use `ClansStatisticsCacheProfile.Name`. The result will look more or less like this:

{{<highlight cs>}}
[ResponseCache(CacheProfileName = ClansStatisticsCacheProfile.Name)]
[OutputCache(PolicyName = ClansStatisticsCacheProfile.Name)]
{{</highlight>}}

And just like that, ASP.NET Core should respect our caching configuration while we (finally) got rid of all the mess in Program.cs.

## Should we keep both attributes?
You might wonder why I keep both caching mechanisms in parallel and put 2 attributes on the same route. Well, there's 2 reasons: one is "to show an example", but the second reason is much more impactful.

If you remember the beginning of this post, I mentioned that **Output Caching** does not tell the client how to handle the cache. Keeping **Response Caching** attributes will add cache-control header for us, while **Output Caching** will actually respond with cached version.

If we want to tell clients not to ask our server over and over again, we keep both attributes.  
If however we want to support cache invalidation, e-tags etc, we need to remove `[ResponseCache]` attribute.  
On the other hand, if we only want client-side cache to be in effect and for server to skip cache, remove `[OutputCache]` attribute.

{{<admonition type=note title="Middleware Pipeline" >}}
Regardless if we want to keep both attributes or not, we can remove `app.UseResponseCaching()` from Program.cs if we use **Output Caching** - instead we add `app.UseOutputCache()` (after `app.UseRouting()`).

Both middlewares merely handle caching the output and do not affect headers - so we only need one.
{{</admonition >}}

## Next Steps
Now, this solution isn't 100% feature complete. As you might've noticed:
- The profile needs to have parameter-less constructor since we use `Activator.CreateInstance`;
- We don't have all features supported by **Output Caching**;
- We need to use 2 attributes to use both mechanisms at once.

The reason for these drawbacks in my current implementation was YAGNI - my current needs are satisfied with this simple implementation.  
However this implementation is super easy to expand and/or modify as needed - for example adding new optional properties to base class and then handling them within the extension method is enough to support the extended feature set of **Output Caching**. Parameter-less constructor requirement is a bit more tricky, but loading logic can be modified to handle that if needed.

Once (if) I extend this solution, I'll update this blog post. However this already helps with making the project more maintainable
