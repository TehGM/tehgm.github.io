---
title: "TehGM's C# Utilities v0.1.0"
slug: tehgm-csharp-utilities-v0-1-0
subtitle: ""
description: "Initial version of TehGM's C# Utilities released - but what is that?"

date: 2022-06-24T00:39:06+01:00
lastmod: 2022-06-24T00:39:06+01:00
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

Every time I start a new project, there's a ton of boilerplate code to paste from other projects.  

Examples are many. 2 most recent ones I needed are support for Unix Timestamp in JSON, and short-ish (22 chars) representation of GUID (say, for URLs or whatever).

Every new project meant copying code from one of previous projects. I mean - I already implemented it, it works, and fits multiple projects perfectly. Not gonna do the same thing again. Ctrl+C, Ctrl+V we go!  
I got tired of it. This is tedious, leads to code duplication, etc... I decided to address that. NuGet.org to the rescue!

## What is TehGM's C# Utilities
TehGM's C# Utilities is the unimaginative name I gave to a set of libraries that contain code that I kept reusing over and over again. They're designed for my own purposes, but each of them is quite lightweight and universal, so I imagine virtually anyone could make use of them.

All of the libraries are available on [nuget.org](https://www.nuget.org/packages/TehGM.Utilities), and they're wrapped by one metapackage for easy installation.
{{<highlight bash>}}
dotnet add package TehGM.Utilities
{{</highlight>}}

But since under the hood it's just a set of small libraries, you can install each individually if you want to. This might be helpful for example when using Blazor WASM.
{{<highlight bash>}}
dotnet add package TehGM.Utilities.UniqueIDs
dotnet add package TehGM.Utilities.Logging
dotnet add package TehGM.Utilities.Randomization
dotnet add package TehGM.Utilities.Time
dotnet add package TehGM.Utilities.Validation
{{</highlight>}}

### JSON.NET Support
There are additional packages that need to be installed separately to be used, and they're JSON.NET support packages. Well, just one currently, but in future it is likely that there will be more.

The reason for this is simple - unless JSON.NET becomes a big part of `TehGM.Utilities`, I don't want to introduce yet another dependency when it's not needed. This might matter for things like Blazor WASM.

If you do use JSON.NET, just add additional package. Currently only [TehGM.Utilities.Time](https://www.nuget.org/packages/TehGM.Utilities.Time.JsonNet) has JSON.NET support, so it's easy.
{{<highlight bash>}}
dotnet add package TehGM.Utilities.Time.JsonNet
{{</highlight>}}

{{<admonition type=warning title="JSON.NET Vulnerability">}}
Just recently (a day ago, actually), a [severe vulnerability](https://github.com/advisories/GHSA-5crp-9r3c-p9vr) was found in JSON.NET before version 13.0.1.

My package depends on JSON.NET 11.0.1 or greater. This is purely for compatibility, but you should manually install [Newtonsoft.Json version 13.0.1](https://www.nuget.org/packages/Newtonsoft.Json/) or greater.
{{</admonition>}}

### Version v0.1.0
This package is released as version v0.1.0. This is because it's very small now, and as I expand it, I might notice I could've structured many things better. This could very likely lead to breaking changes.

By using version lower than v1.0.0, I give myself the comfort of being able to change anything without officially worrying about backwards compatibility.  
Of course it means that potential consumers of the library need to be more careful with updating - but hopefully I won't break stuff too much!

### Open Source
This project is entirely open source - go check it out!

https://github.com/TehGM/TehGM.Utilities

## Included Utilities
Okay, that's all cool. But what utilities are offered in the first release?

### Unique IDs
[TehGM.Utilities.UniqueIDs](https://www.nuget.org/packages/TehGM.Utilities.UniqueIDs) package currently contains one struct: `Base64Guid`. This struct wraps .NET's native Guid struct, but automatically offers conversion to a short (for a GUID), 22 character long string. This string value can be safely converted back to a full Guid. This can be useful for storing Guid in your database, but using shorter strings on your website.

22 characters is still longer than a sequential ID processed by [Hashids](https://hashids.org/net/) will be, but the benefit of `Base64Guid` is that it'll be globally unique and doesn't need to be sequential.

{{<highlight csharp>}}
using TehGM.Utilities;

Guid guid = Guid.NewGuid();
Console.WriteLine(guid);				// outputs a750677d-f7ab-43e8-a306-c4f56b5f1bd9
Base64Guid guidBase64 = guid;
Console.WriteLine(guidBase64);			// outputs fWdQp6v36EOjBsT1a18b2Q

// works both ways
guidBase64 = "fWdQp6v36EOjBsT1a18b2Q";
Console.WriteLine(guidBase64.Value);	// outputs a750677d-f7ab-43e8-a306-c4f56b5f1bd9
{{</highlight>}}

### Unix Timestamps
Currently the only feature of [TehGM.Utilities.Time](https://www.nuget.org/packages/TehGM.Utilities.Time) package is `UnixTimestamp`. This struct handles converting of `DateTime` and `DateTimeOffset` values into unix timestamp values, which may be useful for any kind of Web APIs and more.  
Note that explicit cast is required as `DateTime` is much more precise than unix timestamps, but it is what it is!

{{<highlight csharp>}}
using TehGM.Utilities;

DateTime dt = new DateTime(1999, 04, 10, 07, 00, 02, DateTimeKind.Utc);
Console.WriteLine(dt);						// outputs 04/10/1999 07:00:02 (sorry for .NET Fiddle using American date format :( )
UnixTimestamp timestamp = (UnixTimestamp)dt;
Console.WriteLine(guidBase64);				// outputs 923727602

// works both ways
timestamp = new UnixTimestamp(923727602);
Console.WriteLine(timestamp.ToDateTime());	// outputs 04/10/1999 07:00:02
{{</highlight>}}

[TehGM.Utilities.Time.JsonNet](https://www.nuget.org/packages/TehGM.Utilities.Time.JsonNet) expands this functionality by providing `UnixTimestampConverter` type, so you can annotade any of your properties you use with JSON.NET.
{{<highlight csharp>}}
using Newtonsoft.Json.Converters;

[JsonConverter(typeof(UnixTimestampConverter))]
public UnixTimestamp MyTimestamp { get; set; }
[JsonConverter(typeof(UnixTimestampConverter))]
public DateTime MyDateTime { get; set; }
[JsonConverter(typeof(UnixTimestampConverter))]
public DateTimeOffset MyDateTimeOffset { get; set; }
{{</highlight>}}

### Guid Validation Attribute
[TehGM.Utilities.Validation](https://www.nuget.org/packages/TehGM.Utilities.Validation) package currently is very small, as it only contains one data validation attribute. This attribute is likely most useful in web scenarios, for Razor Pages forms and what not.
{{<highlight csharp>}}
using System.ComponentModel.DataAnnotations;

[Guid]
public Guid MyGuid { get; set; }
[Guid]
public string MyStringGuid { get; set; }
{{</highlight>}}

### Context-aware Exception Logging
Logging is great, and goes well in pair with catching exceptions.  
However, log context doesn't go well with exceptions. It is lost, because `catch` clause executes in different scope than rest of the code. There is a [workaround](https://stackoverflow.com/questions/71519014/how-to-preserve-log-scopes-for-unhandled-exceptions) for this - logging using `when` keyword.

However conditional catching expects the code to return a boolean. It makes sense... but it means that for every single project I was writting a set of methods that simply log exception and return false.  
[TehGM.Utilities.Logging](https://www.nuget.org/packages/TehGM.Utilities.Logging) includes these methods for you, so you can use them without having to rewrite them every. single. time.
{{<highlight csharp>}}
using TehGM.Utilities;

ILogger log;
try
{
	// some code
}
catch (Exception ex) when (ex.LogAsError(log, "An error has occured")) { }
{{</highlight>}}

### Random Seed
As you probably know already, `Random` class can use an integer value as seed. Every time `Random` is initialized with same seed, it'll output the same sequence. This can be useful when trying to recreate something from the seed every time.  
The problem starts when you want to use string as seed in .NET Core. In .NET Core, GetHashCode for string "foobar" will output the same value only until you restart the application! This is actually intended, and as Andrew Lock explains in his [blog post](https://andrewlock.net/why-is-string-gethashcode-different-each-time-i-run-my-program-in-net-core/), you actually want that to be the case in many applications.

This however doesn't help if you want to use that string as a seed! That's where `RandomSeed` from [TehGM.Utilities.Randomization](https://www.nuget.org/packages/TehGM.Utilities.Randomization) package comes into play.

`RandomSeed` is a simple struct that merely holds an int. The power of this Struct comes from its `FromString` method. This method will generate a hashcode from string that is the same every time you run the application, no matter what .NET framework version you use.

{{<highlight csharp>}}
using TehGM.Utilities.Randomization;

RandomSeed seed = RandomSeed.FromString("abcdef");
Console.WriteLine(seed);			// will output 982435995 every time
Random random = new Random(seed);	// can be used as-is with Random class, too
{{</highlight>}}

### IRandomizer and IRandomizerProvider
[TehGM.Utilities.Randomization](https://www.nuget.org/packages/TehGM.Utilities.Randomization) also includes 2 services: `IRandomizer` and `IRandomizerProvider`. These 2 services are designed to allow using shared random logic through Dependency Injection - so you might make use of this method:
{{<highlight csharp>}}
using TehGM.Utilities.Randomization;
using TehGM.Utilities.Randomization.Services;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Microsoft.Extensions.DependencyInjection
{
    public static class RandomizerDependencyInjectionExtensions
    {
        public static IServiceCollection AddRandomizer(this IServiceCollection services)
        {
            services.TryAddScoped<IRandomizerProvider, RandomizerProvider>();
            services.TryAddScoped<IRandomizer>(provider => provider.GetRequiredService<IRandomizerProvider>().GetSharedRandomizer());

            return services;
        }
    }
}
{{</highlight>}}

Usage is simple - if you want to use shared `IRandomizer`, simply inject it to your class via constructor. If you want to make use of [RandomSeed](#random-seed), you can inject `IRandomizerProvider` instead, and use its `GetRandomizerWithSeed` method;

{{<highlight csharp>}}
using TehGM.Utilities.Randomization;

private readonly IRandomizer _randomizer;
private readonly IRandomizer _randomizerWithSeed;

public MyService(IRandomizer sharedRandomizer, IRandomizerProvider randomizerProvider)
{
    // shared randomizer can be used as-is
    this._randomizer = sharedRandomizer;
    // to use seed, create randomizer with provider
    // note that IRandomizerProvider doesn't store seeded randomizers
    // so they're re-created every time
    this._randomizerWithSeed = randomizerProvider.GetRandomizerWithSeed("my-seed");
}
{{</highlight>}}

{{<admonition type=tip title="Without Dependency Injection">}}
Although `IRandomizer` was designed with DI in mind, it can be used without it. Simply create a new `RandomizerService`, and you can benefit from all of its extension methods as well!

{{<highlight csharp>}}
using TehGM.Utilities.Randomization;
using TehGM.Utilities.Randomization.Services;

IRandomizer randomizer = new RandomizerService();
// or with seed
randomizer = new RandomizerService("my-seed");
{{</highlight>}}
{{</admonition>}}

`IRandomizer` itself also has a few useful methods and extensions for common use cases:
{{<highlight csharp>}}
using TehGM.Utilities.Randomization;

// get random int or double between 0 and 10, inclusively
int randomInt = _randomizer.GetRandomNumber(0, 10, inclusive: true);
double randomDouble = _randomizer.GetRandomNumber(0.0, 10.0);

// get random chance - 0.0 for 0%, 1.0 for 100%
double randomChance = _randomizer.GetRandomChance();

// check against chance - following example has 20% to return true
bool didIWin = _randomizer.RollChance(0.2);

// get a random value from any collection/enumerable
MyThing[] myThings = new MyThing[] { /* ... */ };
MyThing myRandomThing = _randomizer.GetRandomValue(myThings);

// get a random enum option
MyEnum randomEnumValue = _randomizer.GetRandomEnumValue<MyEnum>();
{{</highlight>}}

## That's not a lot
Nope, it's not. Currently [TehGM.Utilities](https://www.nuget.org/packages/TehGM.Utilities) has only a small set of features. However I'll likely expand it sooner or later - in fact, I already have one useful feature in mind that I use in some of my projects, but for now I sent it to the drawing board - while in my projects it usually is used in a very specific way, for a library I'd want it to be as flexible and customizable as reasonably possible. Later I also will probably add more reusable pieces as I see myself using them repeatedly across my projects.

Until then, I think this set of features is still useful, even if not big. I found that these features are required often enough, and with this set of libraries, I hopefully no longer will need to keep copying them from one project to another.