---
title: "Adding Regex Commands to Discord.Net's Command System"
slug: discordnet-regex-commands
subtitle: ""
description: "Discord.Net isn't the most extensible library - but let's see if we can extend it to support Regex-based commands!"

date: 2020-11-17T16:19:45+01:00
lastmod: 2020-11-17T16:19:45+01:00
draft: false
list: true
hiddenFromSearch: false
type: blog

categories: [ "Technology" ]
tags: [ "guide", "dev" ]
series: [ ]
aliases: [ ]

featuredImage: ""
featuredImagePreview: ""
lightgallery: false
fontawesome: true

code:
  maxShownLines: 60
---

Discord.Net includes a basic string + parameters Command System, which is enough for most peoples' needs. However I like to use Regex for my commands. In this blog post, I explain how I added Regex Commands support for my personal admin bot [Einherji](https://github.com/TehGM/EinherjiBot).
<!--more--> 

## Why Regex Commands?
Rigid string (that is - type exactly X, Y and Z in correct order) commands are simple and do the job - that's why most people use them. And it's all fine, they work and don't require complex syntax like one of regex.  
However, I do not fear regex - maybe I'm no regex expert, but I am fluent with it enough to use it with confidence. And this allows me to do things fancy way, exactly like I like to. Example? Einherji's [move all command](https://github.com/TehGM/EinherjiBot/blob/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.General/Administration/AdminCommandsHandler.cs#L41) allows for following format: `move all (from) <src-channel> (to) <dest-channel>` - where channels can both be just an ID or a channel ping (in theory - Discord doesn't allow pinging voice channels for now), and "from" and "to" are completely optional but fully accepted. This command, including finding of the channel IDs, is a complete one-liner:
{{<highlight cs>}}
Match match = Regex.Match(input, @"^move\s?all(?:(?: from)?\s+(?:<#)?(\d+)(?:>)?)?(?:(?: to)?\s+(?:<#)?(\d+)(?:>)?)?", RegexOptions.IgnoreCase);
{{</highlight>}}
Yes, I know, it might look scary - but once you learn how to Regex, it's a tad less scary, while opening world of possibilities.

I used to support Regex Commands by adding them in a handler constructor through my [Discord.Net-Helper](https://github.com/TehGM/Discord.Net-Helper) project, but this approach, along with the entire project itself, was less than perfect and suffered from some issues - such as dependency on concrete classes and almost no Dependency Injection support, so I abandoned it since. It should still work and you're free to check it out or even use if you want - but I consider it obsolete.

Additionally, I plan to add Commands System to my [Wolfringo](https://github.com/TehGM/Wolfringo) library for WOLF/Palringo - Commands System is one of the main things still missing. I figured that extending Discord.Net's Command System will be a good practice before writing my own system from scratch - it will let me know what to keep in mind, what to avoid, and where to be cautious.

## Discord.Net's existing commands
Discord.Net includes its own [Command System](https://discord.foxbot.me/docs/guides/commands/intro.html). It belongs to the rigid category - it supports a constant string and parameters for input. As I mentioned [before](#why-regex-commands), it is enough for needs of most people - especially ones that aren't as crazy for fancy command structures like me. I decided to try to build on top of that.  
Sadly Discord.Net isn't one of the libraries that really care about extensibility, and some things depend on concrete classes. It is less than perfect, but Discord.Net's commands also have a few really strong characteristics - some I might even end up borrowing for my [Wolfringo](https://github.com/TehGM/Wolfringo):
- It requires writing your own [Command Handler](https://discord.foxbot.me/docs/guides/commands/intro.html#get-started) - for many it's an annoyance, but I see it as a place to be flexible - and that means I can use this to make Regex Commands work.
- Its attributes (such as [Preconditions](https://discord.foxbot.me/docs/guides/commands/preconditions.html)) are modular in nature - you just add multiple attributes to command method. This allows me to reuse them for my own purposes.
- It supports [Dependency Injection](https://discord.foxbot.me/docs/guides/commands/dependency-injection.html) using .NET's native interfaces - this is huge. I mean, HUGE. This allows passing virtually anything to the command method/class - and it fits extremely nicely with [.NET Generic Host](https://docs.microsoft.com/en-gb/aspnet/core/fundamentals/host/generic-host?view=aspnetcore-3.1) approach, such as ASP.NET Core. This is a big win.

## Regex Commands Implementation
### CommandsOptions
Options Pattern really works well with Dependency Injection - especially if used with [.NET Generic Host](https://docs.microsoft.com/en-gb/aspnet/core/fundamentals/host/generic-host?view=aspnetcore-3.1). For that reason, I set my regex commands to use a [CommandsOptions](https://github.com/TehGM/EinherjiBot/blob/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.Shared/CommandsProcessing/CommandsOptions.cs) class. It is basically a POCO object for settings that can be overwritten in ASP.NET Core settings:
{{<highlight cs>}}
public class CommandsOptions
{
    public string Prefix { get; set; } = ".";
    public bool AcceptMentionPrefix { get; set; } = true;
    public bool AcceptBotMessages { get; set; } = false;
    public bool RequirePublicMessagePrefix { get; set; } = true;    // if false, prefix won't be required in guild channels
    public bool RequirePrivateMessagePrefix { get; set; } = false;  // if false, prefix won't be required in private messages

    public bool CaseSensitive { get; set; } = false;
    public RunMode DefaultRunMode { get; set; } = RunMode.Default;
    public bool IgnoreExtraArgs { get; set; } = true;

    // for loading
    public ICollection<Type> Classes { get; set; } = new List<Type>();  // classes that Regex Command System will look at when initializing
    public ICollection<Assembly> Assemblies { get; set; } = new List<Assembly>() { Assembly.GetEntryAssembly() };   // assemblies that Regex Command System will look at when initializing
}
{{</highlight>}}
{{<admonition type=info title="More information">}}
See [Options pattern in ASP.NET Core](https://docs.microsoft.com/en-gb/aspnet/core/fundamentals/configuration/options?view=aspnetcore-3.1) for more information on using Options Pattern.
{{</admonition>}}

### Regex Command Instance
{{<admonition type=note title="Naming explanation">}}
The instance name might be a little bit misleading at first - it refers to parsed instance of a [\[RegexCommand\] Attribute](#regexcommand-attribute), not the actual object of a class that the command method will be executed it - the latter I called RegexCommandModuleInstance. I think I need to work on my naming skills before adding command system to [Wolfringo](https://github.com/TehGM/Wolfringo). :(far fa-grin-beam-sweat):
{{</admonition>}}
#### [RegexCommand] Attribute
Let's start with defining Regex Command as an attribute - this will allow to mark a method to be handled as a Regex Command.
{{<highlight cs>}}
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true, Inherited = false)]
public class RegexCommandAttribute : Attribute
{
    public const RegexOptions DefaultRegexOptions = RegexOptions.CultureInvariant | RegexOptions.Multiline;

    public string Pattern { get; }
    public RegexOptions RegexOptions { get; }

    public RegexCommandAttribute(string pattern)
        : this(pattern, DefaultRegexOptions) { }

    public RegexCommandAttribute(string pattern, RegexOptions options)
    {
        this.Pattern = pattern;
        this.RegexOptions = options;
    }
}
{{</highlight>}}

This class is pretty self-explanatory. We have pattern, and default `RegexOptions` that can be overriden in a constructor. The attribute can be set on the method multiple times - it'll work as an alias.

#### RegexCommandInstance Constructor and Properties
The 2nd class, `RegexCommandInstance`, is a tad bigger, so let's break it up. If you'd like to see the full class all at once, check it out on [GitHub](https://github.com/TehGM/EinherjiBot/blob/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.Shared/CommandsProcessing/Services/RegexCommandInstance.cs).  
First, let's have the things we need provided through a constructor.
{{<highlight cs>}}
public Regex Regex { get; }
public Type ModuleType => _method.DeclaringType;
public string MethodName => _method.Name;
private readonly MethodInfo _method;
private readonly ParameterInfo[] _params;
private readonly IRegexCommandModuleProvider _moduleProvider;

private RegexCommandInstance(Regex regex, MethodInfo method, IRegexCommandModuleProvider moduleProvider)
{
    this.Regex = regex;

    this._method = method;
    this._params = method.GetParameters();      // this will get all parameters the command method accepts

    this._moduleProvider = moduleProvider;
}
{{</highlight>}}
I think this part is mostly self-explanatory. Constructor takes a Regex instance that will trigger this command, a MethodInfo for the method that will be executed, and an `IRegexCommandModuleProvider` - a service that will cache results of lookups on how to create command instances. Don't worry, it'll be explained [below](#command-module-provider).

#### Preconditions and Priority
We want Preconditions and Priority to be supported. We will use Discord.Net's existing [\[Precondition\] Attribute](https://github.com/discord-net/Discord.Net/blob/dev/src/Discord.Net.Commands/Attributes/PreconditionAttribute.cs) and [\[Priority\] Attribute](https://github.com/discord-net/Discord.Net/blob/dev/src/Discord.Net.Commands/Attributes/PriorityAttribute.cs) - they're mostly fine, with one exception.
Discord.Net Precondition's `CheckPermissionsAsync` method takes a [CommandInfo](https://github.com/discord-net/Discord.Net/blob/dev/src/Discord.Net.Commands/Info/CommandInfo.cs) as a parameter. [CommandInfo](https://github.com/discord-net/Discord.Net/blob/dev/src/Discord.Net.Commands/Info/CommandInfo.cs) is closely related to [CommandService](https://github.com/discord-net/Discord.Net/blob/dev/src/Discord.Net.Commands/CommandService.cs), which is designed for the 'rigid' commands. This is one place where Discord.Net's lack of extensibility support shows.  
To work this around, we pass `null` in place of `CheckPermissionsAsync`. This could cause issue for some preconditions, but as of Discord.Net 2.2.0, none of the [built-in Preconditions](https://github.com/discord-net/Discord.Net/tree/dev/src/Discord.Net.Commands/Attributes/Preconditions) use that param, so with these, we're safe... for now.

{{<highlight cs>}}
// add these as class properties
public int Priority { get; private set; }
public IEnumerable<PreconditionAttribute> Preconditions { get; private set; }

// set their default values in the constructor
private RegexCommandInstance(Regex regex, MethodInfo method, IRegexCommandModuleProvider moduleProvider)
{
    this.Priority = 0;
    this.Preconditions = new List<PreconditionAttribute>();

    // ... other constructor code ...
}

// method to load up preconditions and priority
private void LoadCustomAttributes(ICustomAttributeProvider provider)
{
    IEnumerable<object> attributes = provider.GetCustomAttributes(true);

    foreach (object attr in attributes)
    {
        switch (attr)
        {
            case PreconditionAttribute precondition:
                (this.Preconditions as ICollection<PreconditionAttribute>).Add(precondition);
                break;
            case PriorityAttribute priority:
                this.Priority = priority.Priority;
                break;
        }
    }
}

// method to execute the preconditions
public async Task<PreconditionResult> CheckPreconditionsAsync(ICommandContext context, IServiceProvider services)
{
    foreach (PreconditionAttribute precondition in Preconditions)
    {
        PreconditionResult result = await precondition.CheckPermissionsAsync(context, null, services).ConfigureAwait(false);
        if (!result.IsSuccess)
            return result;
    }
    return PreconditionResult.FromSuccess();
}
{{</highlight>}}

#### Building the Command
Next, we want a method that performs building of the command instance. First, let's add an additional property that will determine how the command is executed:
{{<highlight cs>}}
public RunMode RunMode
{
    get => _runMode == RunMode.Default ? RunMode.Sync : _runMode;
    set => _runMode = value;
}

private RunMode _runMode = RunMode.Default;
{{</highlight>}}

Next, let's add a static Build method - it'll be called when initializing the command instance by [Command Handler](#regex-command-handler).
{{<highlight cs>}}
public static RegexCommandInstance Build(MethodInfo method, RegexCommandAttribute regexAttribute, IServiceProvider services)
{
    if (method == null)
        throw new ArgumentNullException(nameof(method));
    if (regexAttribute == null)
        throw new ArgumentNullException(nameof(regexAttribute));

    // init instance
    CommandsOptions options = services.GetService<IOptions<CommandsOptions>>()?.Value;
    RegexOptions regexOptions = regexAttribute.RegexOptions;
    if (options?.CaseSensitive != true)
        regexOptions |= RegexOptions.IgnoreCase;
    IRegexCommandModuleProvider moduleProvider = services.GetRequiredService<IRegexCommandModuleProvider>();
    RegexCommandInstance result = new RegexCommandInstance(new Regex(regexAttribute.Pattern, regexOptions), method, moduleProvider);
    result.RunMode = options?.DefaultRunMode ?? RunMode.Default;

    // first load base type attributes
    result.LoadCustomAttributes(method.DeclaringType);
    // then load method attributes (and let them overwrite class ones if necessary)
    result.LoadCustomAttributes(method);

    return result;
}
{{</highlight>}}

This method will grab provided MethodInfo and [\[RegexCommand\] Attribute](#regexcommand-attribute), along with DI ServiceProvider.  
Then it takes [CommandsOptions](#commandsoptions) and [IRegexCommandModuleProvider](#command-module-provider) from the DI ServiceProvider, and uses them to create an instance of the class. Lastly, it calls [LoadCustomAttributes](#preconditions-and-priority) twice - first time to grab any attributes on the class that the method is in - and then overwrite with or add the ones that are set on the method itself.

#### Execute Method
Now we can add a method to let actually execute the command - this method will be called by [Command Handler](#regex-command-handler) if all preconditions passed.
{{<highlight cs>}}
public async Task<IResult> ExecuteAsync(ICommandContext context, int argPos, IServiceProvider services, CancellationToken cancellationToken = default)
{
    // check regex
    string msg = context.Message.Content.Substring(argPos);
    Match regexMatch = this.Regex.Match(msg);
    if (regexMatch == null || !regexMatch.Success)
        return ExecuteResult.FromError(CommandError.ParseFailed, "Regex did not match");

    // build params
    cancellationToken.ThrowIfCancellationRequested();
    object[] paramsValues = new object[_params.Length];
    foreach (ParameterInfo param in _params)
    {
        object value = null;
        if (param.ParameterType.IsAssignableFrom(context.GetType()))
            value = context;
        else if (param.ParameterType.IsAssignableFrom(typeof(Match)))
            value = regexMatch;
        else if (param.ParameterType.IsAssignableFrom(context.Message.GetType()))
            value = context.Message;
        else if (param.ParameterType.IsAssignableFrom(context.Guild.GetType()))
            value = context.Guild;
        else if (param.ParameterType.IsAssignableFrom(context.Channel.GetType()))
            value = context.Channel;
        else if (param.ParameterType.IsAssignableFrom(context.User.GetType()))
            value = context.User;
        else if (param.ParameterType.IsAssignableFrom(context.Client.GetType()))
            value = context.Client;
        else if (param.ParameterType.IsAssignableFrom(typeof(CancellationToken)))
            value = cancellationToken;
        else
        {
            value = services.GetService(param.ParameterType);
            if (value == null)
            {
                if (param.IsOptional)
                    value = param.HasDefaultValue ? param.DefaultValue : null;
                else
                    return ExecuteResult.FromError(CommandError.ObjectNotFound, $"Unsupported param type: {param.ParameterType.FullName}");
            }
        }
        paramsValues[param.Position] = value;
    }

    // create class instance, or use pre-initialized if command has that flag
    cancellationToken.ThrowIfCancellationRequested();
    object instance = _moduleProvider.GetModuleInstance(this);

    // execute
    if (_method.Invoke(instance, paramsValues) is Task returnTask)
    {
        if (RunMode == RunMode.Sync)
            await returnTask.ConfigureAwait(false);
        else
            _ = Task.Run(async () => await returnTask.ConfigureAwait(false), cancellationToken);
    }
    return ExecuteResult.FromSuccess();
}
{{</highlight>}}

This method requires some explanation.
1. First, the method simply checks if the regex matches the message sent to the bot. If not, it'll return quickly, telling the [Command Handler](#regex-command-handler) that the execute was not successful, so it should try another command.
2. If the regex match was found, the method iterates over parameters excpected by the command method. For each param, it checks the type of the parameter. If the type was found, it'll be provided to the method. Otherwise, it'll return an error of unsupported param type, or if the param is optional, provide a default.  
    * First it checks if it's the [ICommandContext](https://github.com/discord-net/Discord.Net/blob/dev/src/Discord.Net.Core/Commands/ICommandContext.cs) that is already used by Discord.Net's default Command System, or any of the classes that implement it.  
    * Then it checks if it is a Regex match. This allows the command method to use Regex match to grab groups etc, which can be used as command arguments.  
    * Then it checks if it is any of the properties that are provided by [ICommandContext](https://github.com/discord-net/Discord.Net/blob/dev/src/Discord.Net.Core/Commands/ICommandContext.cs). This allows command method to take a guild or user as one of the params.  
    * Then it checks if it's a `CancellationToken`, to support async execution cancellation.  
    * If none of these are true, as last resort it'll try to use `IServiceProvider` - this allows for injecting any service from DI into the method as a param.  
3. Once values for all method params are found, it'll use [IRegexCommandModuleProvider](#command-module-provider) to get the module instance.
4. Lastly, it'll actually execute the method. If the method returns a `Task`, it'll await it, or put it on a thread pool, depending on RunMode setting.
5. Once done, it'll return success to [Command Handler](#regex-command-handler). Yay!

### Command Module Provider
I mentioned a module provider multiple times, now it's time to implement it. You can also see it on [GitHub](https://github.com/TehGM/EinherjiBot/blob/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.Shared/CommandsProcessing/Services/RegexCommandModuleProvider.cs).

`IRegexCommandModuleProvider` in my Commands System is designed to improve performance of command execution. To stay consistent with Discord.Net default approach to [re-initialize a fresh instance for every execution](https://discord.foxbot.me/docs/guides/commands/intro.html#modules), a lot of reflection would be used to find a constructor that can be resolved with things that are in DI container. To avoid this overhead, I chose to cache constructor selection for each command instance.  

#### [PersistentModule] Attribute
On top of caching known constructors, using a module provider allows for having a persistent instances - ones that should NOT be recreated and scrapped for every execution. I find this useful for command classes that either listen to gateway events, or have a background Task. In Einherji I used that in a few places - for example with [Elite Dangerous Community Goals feature](https://github.com/TehGM/EinherjiBot/blob/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.General/EliteDangerous/CommunityGoalsHandler.cs).

To enable with this behaviour, I added a new attribute, which I called `[PersistentModule]`:
{{<highlight cs>}}    
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public class PersistentModuleAttribute : Attribute
{
    public bool SharedInstance { get; set; } = true;
    public bool PreInitialize { get; set; } = false;

    public PersistentModuleAttribute() { }
}
{{</highlight>}}

This attribute allows for specifying additional behaviours that are related:
- `SharedInstance` - if set to true, all command methods inside the same class will share the instance of the command.
- `PreInitialize` - if set to true, the command instance will be added to [IRegexCommandModuleProvider](#iregexcommandmoduleprovider) as soon as it's built. If false, it'll be added when executing for the first time.

Before moving on to implementation of [IRegexCommandModuleProvider](#iregexcommandmoduleprovider) itself, let's just add support for `PreInitialize` being false. To do so, we need to modify [Build](#building-the-command) method a little bit.  
Let's add these 3 lines just before the method returns:
{{<highlight cs "hl_lines=5-7">}}
public static RegexCommandInstance Build(MethodInfo method, RegexCommandAttribute regexAttribute, IServiceProvider services)
{
    // .. other command building code ..

    PersistentModuleAttribute persistent = method.DeclaringType.GetCustomAttribute<PersistentModuleAttribute>();
    if (persistent != null && persistent.PreInitialize)
        result._moduleProvider.GetModuleInstance(result);

    return result;
}
{{</highlight>}}

These lines will check for existence of the `[PersistentModule]` attribute, check if `PreInitialize` is true, and if so, request the module from [IRegexCommandModuleProvider](#iregexcommandmoduleprovider) - this will trigger its instantiation.

#### IRegexCommandModuleProvider
Now we can create the module provider itself.  
The `IRegexCommandModuleProvider` is really simple:
{{<highlight cs>}}
public interface IRegexCommandModuleProvider
{
    object GetModuleInstance(RegexCommandInstance commandInstance);
}
{{</highlight>}}

The concrete implementation itself is relatively easy, too, but has some parts that need explaining, so let's go step by step.

##### IRegexCommandModuleProvider Constructor and Properties
The constructor and properties for this class is relatively simple - we just take an `IServiceProvider`, store it, and initialize empty collections:
- Dictionary of known modules, which is simply a cache of "which [RegexCommandModuleInfo](#regexcommandmoduleinfo) should I use for this [RegexCommandInstance](#regex-command-instance)?".
- Dictionary of module instances with [\[PersistentModule\] Attribute](#persistentmodule-attribute), so they can be easily reused.
- Dictionary of shared module instances, defined with `SharedInstance` in [\[PersistentModule\] Attribute](#persistentmodule-attribute), keyed by the class type that defines the command methods.
{{<highlight cs>}}
public class RegexComandModuleProvider : IRegexCommandModuleProvider
{
    private readonly IServiceProvider _services;
    private readonly IDictionary<Type, object> _sharedInstances;
    private readonly IDictionary<RegexCommandInstance, object> _persistentInstances;
    private readonly IDictionary<RegexCommandInstance, RegexCommandModuleInfo> _knownModules;

    public RegexComandModuleProvider(IServiceProvider services)
    {
        this._services = services;
        this._sharedInstances = new Dictionary<Type, object>();
        this._persistentInstances = new Dictionary<RegexCommandInstance, object>();
        this._knownModules = new Dictionary<RegexCommandInstance, RegexCommandModuleInfo>();
    }
}
{{</highlight>}}

##### RegexCommandModuleInfo
`RegexCommandModuleInfo` is a simple class, used only by `IRegexCommandModuleProvider`, which holds information on the [PersistentModule] Attribute values, the constructor that was found suitable, and the parameters to use when using that constructor. Let's create it!
{{<highlight cs>}}
private class RegexCommandModuleInfo
{
    public Type Type { get; }
    public bool IsShared { get; }
    public bool IsPersistent { get; }
    private readonly ConstructorInfo _ctor;
    private readonly object[] _params;

    public RegexCommandModuleInfo(ConstructorInfo ctor, object[] parameters)
    {
        this._ctor = ctor;
        this._params = parameters;

        this.Type = ctor.DeclaringType;
        PersistentModuleAttribute persistent = this.Type.GetCustomAttribute<PersistentModuleAttribute>();
        this.IsPersistent = persistent != null;
        this.IsShared = this.IsPersistent && persistent.SharedInstance;
    }

    public object CreateInstance()
        => _ctor.Invoke(_params);
}
{{</highlight>}}

To initialize this class, let's add a new method `InitializeModuleInfo` into our `RegexCommandModuleProvider`. This method will take a constructor info as input, and try to use `IServiceProvider` to resolve all of its params. If it can resolve all, it'll return a new [RegexCommandModuleInfo](#regexcommandmoduleinfo), otherwise it'll return null. It'll also check if param is optional - if it is and service cannot be resolved, it'll just use the default.
{{<highlight cs "hl_lines=5-22">}}
public class RegexComandModuleProvider : IRegexCommandModuleProvider
{
    // .. properties and constructor ..

    private RegexCommandModuleInfo InitializeModuleInfo(ConstructorInfo constructor)
    {
        ParameterInfo[] ctorParams = constructor.GetParameters();
        object[] paramsValues = new object[ctorParams.Length];
        foreach (ParameterInfo param in ctorParams)
        {
            object value = _services.GetService(param.ParameterType);
            if (value == null)
            {
                if (param.IsOptional)
                    value = param.HasDefaultValue ? param.DefaultValue : null;
                else
                    return null;
            }
            paramsValues[param.Position] = value;
        }
        return new RegexCommandModuleInfo(constructor, paramsValues);
    }
}
{{</highlight>}}

##### Retrieving the module
Now for the main star of the module provider - method `GetModuleInstance`. Don't worry, it isn't too complex. To make it simpler, let's break it into steps.

First, let's check if the [RegexCommandModuleInfo](#regexcommandmoduleinfo) was already created before - if so, it'll be cached in `_knownModules` dictionary. If it's not found, we will grab all constructors in the command class, and order it from the one with most parameters to the one with the least - this will allow to attempt to resolve most services possible - ASP.NET Core `IServiceProvider` does by default, too.  
For each of the constructors, we attempt to create a [RegexCommandModuleInfo](#regexcommandmoduleinfo) using `InitializeModuleInfo` method we created just a moment ago. If it returns null, we check next constructor, otherwise we found our constructor and can cache it in `_knownModules` dictionary!
If we checked all constructors and all returned null, we have an error, so let's throw an exception.
{{<highlight cs>}}
public object GetModuleInstance(RegexCommandInstance commandInstance)
{
    RegexCommandModuleInfo moduleInfo;
    // check if we have constructor info cached
    if (!_knownModules.TryGetValue(commandInstance, out moduleInfo))
    {
        // get all constructors
        IEnumerable<ConstructorInfo> constructors = commandInstance.ModuleType
            .GetConstructors(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
            // order them by params count
            .OrderByDescending(ctor => ctor.GetParameters().Length);
        // try to resolve all services for each constructor
        foreach (ConstructorInfo ctor in constructors)
        {
            moduleInfo = InitializeModuleInfo(ctor);
            if (moduleInfo != null)
            {
                // great, we found a constructor we can resolve!
                _knownModules.Add(commandInstance, moduleInfo);
                break;
            }
        }
        // if we can't resolve any constructor, we have an error :(
        if (moduleInfo == null)
            throw new InvalidOperationException($"Cannot create {commandInstance.ModuleType.FullName} - none of the constructors can have its dependencie resolved");
    }

    // ...
}
{{</highlight>}}

Next, if we determined we can create the command module instance by finding a constructor, let's check if this [RegexCommandInstance](#regex-command-instance) already has a persistent module, using a simple dictionary check.
{{<highlight cs>}}
public object GetModuleInstance(RegexCommandInstance commandInstance)
{
    // ...
    if (_persistentInstances.TryGetValue(commandInstance, out object instance))
        return instance;
    // ...
}
{{</highlight>}}

Then, if it's not a persistent instance we already created - it could be that the command class is persistent AND shared - and that means, if any other method of that class created a module instance, we can use it for this command too! If that's the case, we add that instance to `_persistentInstances` dictionary - this means the persistent checks step will find this shared instance correctly next time.
{{<highlight cs>}}
public object GetModuleInstance(RegexCommandInstance commandInstance)
{
    // ...
    if (_sharedInstances.TryGetValue(moduleInfo.Type, out instance))
    {
        _persistentInstances.Add(commandInstance, instance);
        return instance;
    }
    // ...
}
{{</highlight>}}

If we still didn't find a cached instance, it means that either it's the first time we're requesting it, or it's not a persistent module at all. In either case, we create it. Then we can check if it's a persistent or shared module - if so, we add it to cache dictionaries. Once we do this, we can return the instance.

{{<highlight cs>}}
public object GetModuleInstance(RegexCommandInstance commandInstance)
{
    // ...
    instance = moduleInfo.CreateInstance();
    if (moduleInfo.IsPersistent)
    {
        _persistentInstances.Add(commandInstance, instance);
        if (moduleInfo.IsShared)
            _sharedInstances.Add(moduleInfo.Type, instance);
    }

    return instance;
}
{{</highlight>}}

And that covers the `IRegexCommandModuleProvider` implementation. Wasn't that bad, eh? And we're almost done, we just need a [Command Handler](#regex-command-handler) now.


### Regex Command Handler
Discord.Net requires you to write a [Command Handler](https://discord.foxbot.me/docs/guides/commands/intro.html#get-started) for normal commands. For regex commands, we do something really similar. The only difference is that we don't have a [CommandService](https://discord.foxbot.me/docs/api/Discord.Commands.CommandService.html) that would load the commands for us - but don't worry, it's quite easy.

For full code, check the code on [GitHub](https://github.com/TehGM/EinherjiBot/blob/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.Shared/CommandsProcessing/Services/RegexCommandHandler.cs).

#### RegexCommandHandler Constructor and Properties
First we need properties to store all the handler needs for modules, and constructor. I am using .NET Core Hosting Dependency Injection to add them all. We also want the handler to implement `IDisposable` to stop listening to Discord.Net Client's events when it's deconstruction time. If you're using [.NET Generic Host](https://docs.microsoft.com/en-gb/aspnet/core/fundamentals/host/generic-host?view=aspnetcore-3.1), you also want to implement `IHostedService` - this will ensure the handler is started when the Host starts.
{{<highlight cs>}}
public class RegexCommandHandler : IHostedService, IDisposable
{
    private readonly DiscordSocketClient _client;
    private readonly IOptionsMonitor<CommandsOptions> _commandOptions;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger _log;
    private ICollection<RegexCommandInstance> _commands;
    private CancellationToken _hostCancellationToken;

    public RegexCommandHandler(IServiceProvider serviceProvider, DiscordSocketClient client, IOptionsMonitor<CommandsOptions> commandOptions,ILogger<RegexCommandHandler> log)
    {
        this._client = client;
        this._commandOptions = commandOptions;
        this._serviceProvider = serviceProvider;
        this._log = log;
        this._commands = new List<RegexCommandInstance>();

        // re-initialize commands when options change
        _commandOptions.OnChange(async _ => await InitializeCommandsAsync());

        // listen to Discord.Net client's MessageReceived event
        this._client.MessageReceived += HandleCommandAsync;
    }

    Task IHostedService.StartAsync(CancellationToken cancellationToken)
    {
        this._hostCancellationToken = cancellationToken;
        return InitializeCommandsAsync();
    }

    Task IHostedService.StopAsync(CancellationToken cancellationToken)
    {
        this.Dispose();
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        this._client.MessageReceived -= HandleCommandAsync;
        this._lock.Dispose();
    }
}
{{</highlight>}}

#### Initializing Commands
As you can see in constructor and `StartAsync`, we need a method `InitializeCommandsAsync`, so let's create it!
{{<highlight cs>}}
private async Task InitializeCommandsAsync()
{
    this._commands.Clear();
    CommandsOptions options = this._commandOptions.CurrentValue;
    foreach (Assembly asm in options.Assemblies)
        this.AddAssembly(asm);
    foreach (Type t in options.Classes)
        this.AddType(t.GetTypeInfo());

    this._commands = _commands.OrderByDescending(cmd => cmd.Priority).ToArray();
}
{{</highlight>}}

In this method, we load each assembly and each class type included in [CommandsOptions](#commandsoptions). Once that is done, we order the commands by `Priority`, to respect [\[Priority\] Attribute](https://github.com/discord-net/Discord.Net/blob/dev/src/Discord.Net.Commands/Attributes/PriorityAttribute.cs).

#### Loading Commands
Initializing is simple, but `AddAssembly` and `AddType` do not exist yet - so let's add them, too!

These methods use reflection to find the types. `AddAssembly` checks all types in assembly that aren't abstract or generic, aren't generated by the compiler, and [\[LoadRegexCommands\] Attribute](#loadregexcommands-attribute) - don't worry, we'll create it in a moment.  
`AddType` does similar, but for methods - it finds all methods that aren't static, generated by the compiler, and have at least one [\[RegexCommand\] Attribute](#regexcommand-attribute).  
Lastly, `AddMethod` builds a new [Regex Command Instance](#regex-command-instance) for each [\[RegexCommand\] Attribute](#regexcommand-attribute) it finds on the method.

{{<highlight cs>}}
private void AddAssembly(Assembly assembly)
{
    IEnumerable<TypeInfo> types = assembly.DefinedTypes.Where(t => !t.IsAbstract && !t.ContainsGenericParameters
        && !Attribute.IsDefined(t, typeof(CompilerGeneratedAttribute)) && Attribute.IsDefined(t, typeof(LoadRegexCommandsAttribute)));
    if (!types.Any())
    {
        _log.LogWarning("Cannot initialize Regex commands from assembly {AssemblyName} - no non-static non-abstract classes with {Attribute}",assembly.FullName, nameof(LoadRegexCommandsAttribute));
        return;
    }
    foreach (TypeInfo type in types)
        AddType(type);
}

private void AddType(TypeInfo type)
{
    IEnumerable<MethodInfo> methods = type.DeclaredMethods.Where(m => !m.IsStatic && !Attribute.IsDefined(m, typeof(CompilerGeneratedAttribute)) &&Attribute.IsDefined(m, typeof(RegexCommandAttribute)));
    if (!methods.Any())
    {
        _log.LogWarning("Cannot initialize Regex command from type {TypeName} - no method with {Attribute}", type.FullName, nameo(RegexCommandAttribute));
        return;
    }
    foreach (MethodInfo method in methods)
        AddMethod(method);
}

private void AddMethod(MethodInfo method)
{
    IEnumerable<RegexCommandAttribute> attributes = method.GetCustomAttributes<RegexCommandAttribute>();
    if (!attributes.Any())
    {
        _log.LogWarning("Cannot initialize Regex command from {TypeName}'s method {MethodName} - {Attribute} missing", method.DeclaringType.FullName,method.Name, nameof(RegexCommandAttribute));
        return;
    }
    foreach (RegexCommandAttribute attribute in attributes)
        _commands.Add(RegexCommandInstance.Build(method, attribute, _serviceProvider));
}
{{</highlight>}}

#### [LoadRegexCommands] Attribute
I mentioned `[LoadRegexCommands]` attribute, even though we never created it. But don't worry, it's really simple. Really:
{{<highlight cs>}}
public class LoadRegexCommandsAttribute : Attribute { }
{{</highlight>}}
Yep. That's it. An empty attribute! Why do we need an empty attribute?
The answer is simple - this limits the amount of checks we will need to do when loading our types from an assembly. With this attribute, `AddAssembly` method will only attempt to load classes that have this attribute present, instead of every single class in your bot. Now, for every class with commands, you add a `[LoadRegexCommands]` attribute, and handler will know it should try to load that class.

This might sound like an inconvenience, but Discord.Net does something similar for its own Command System - except it requires you to inherit from [ModuleBase](https://discord.foxbot.me/docs/guides/commands/intro.html#modules) class.  
I found attribute to be more fitting. Yes, not inheriting from a class means you don't get to use its properties, like `Context` - but it's okay, since we can just add it as a paremeter to the command method. In return, it means we have our 'one inheritance spot' free, and can inherit from any other class we would want to. If you ask me, that's a win!

### Handling a client message
Now, the final piece of our handler - actually handling the incoming messages.

This works very similar to an [example provided by Discord.Net](https://discord.foxbot.me/docs/guides/commands/intro.html#get-started) - the main difference is the last call to `ExecuteAsync` method of the [CommandService](https://discord.foxbot.me/docs/api/Discord.Commands.CommandService.html). Since we don't use [CommandService](https://discord.foxbot.me/docs/api/Discord.Commands.CommandService.html) here, we can't use it. Instead, replace that call with a snippet like following:
{{<highlight cs>}}
foreach (RegexCommandInstance command in _commands)
{
    try
    {
        IResult preconditionsResult = await command.CheckPreconditionsAsync(context, _serviceProvider);
        if (!preconditionsResult.IsSuccess)
            continue;
        ExecuteResult result = (ExecuteResult)await command.ExecuteAsync(
            context: context,
            argPos: argPos,
            services: _serviceProvider,
            cancellationToken: _hostCancellationToken)
            .ConfigureAwait(false);
        if (result.IsSuccess)
            return;
    }
    catch (OperationCanceledException) { return; }
    catch (Exception ex)
    {
        _log.LogError(ex, "Unhandled Exception when executing command {MethodName}", command.MethodName);
        return;
    }
}
{{</highlight>}}

In above snippet, we iterate over each loaded command instance. For each instance we perform following steps.
1. Check preconditions. If preconditions failed, we proceed to next command. This is similar to Discord.Net's [CommandService](https://discord.foxbot.me/docs/api/Discord.Commands.CommandService.html) behaviour.
2. Try to execute the command. We provide in context, arg position, `IServiceProvider`, and `_hostCancellationToken` as a cancellation token.
3. If the execution was successful, we finish.
4. Catch `OperationCanceledException`. We do it separately, as operation canceled is a normal occurence - it'll happen whenever we stop the bot (and therefore set `_hostCancellationToken` to cancelled) when a command execution is still in progress. You can log a warning before returning, it's okay too.
5. Catch any other `Exception` and log it as error.

In my code, before the snippet I have shown above, I also do typical command handler stuff - prefix checking and context class creation. I utilize [CommandsOptions](#commandsoptions) during my prefix checks, so feel free to check the method on [GitHub](https://github.com/TehGM/EinherjiBot/blob/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.Shared/CommandsProcessing/Services/RegexCommandHandler.cs#L100) to see how I do it.

## Using Commands System
That's all the core code needed for regex commands. It was a long and perhaps even confusing, I know, but we're almost done! Now we just need to mark all our command classes with [\[LoadRegexCommands\] Attribute](#loadregexcommands-attribute), and add a [\[RegexCommand\] Attribute](#regexcommand-attribute) to every method that we want to act as a command. Many real commands can be seen in [Einherji source code](https://github.com/TehGM/EinherjiBot/tree/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.General), but here I'll throw one as an example:
{{<highlight cs>}}
[LoadRegexCommands]
[PersistentModule(PreInitialize = true)]
public class AdminCommandsHandler
{
    [RegexCommand("^purge(?:\\s+(\\d+))?")]
    private async Task CmdPurgeAsync(SocketCommandContext message, Match match, CancellationToken cancellationToken = default)
    {
        // your command code goes here!
    }
}
{{</highlight>}}

With commands prepared, we just need to create an instances of [IRegexCommandModuleProvider](#command-module-provider), [RegexCommandHandler](#regex-command-handler) and their required services, and call [InitializeCommandsAsync](#initializing-commands) on the `RegexCommandHandler`. The exact way you do it depends on how you start your bot.

### .NET Generic Host / ASP.NET Core
If you use [.NET Generic Host](https://docs.microsoft.com/en-gb/aspnet/core/fundamentals/host/generic-host?view=aspnetcore-3.1) approach (for example, in ASP.NET Core, but not only), I have a good news for you - this tutorial includes Dependency Injection-enabled classes, and I have a helper class you can add to your project!
{{<highlight cs>}}
namespace Microsoft.Extensions.DependencyInjection
{
    public static class CommandsServiceCollectionExtensions
    {
        public static IServiceCollection AddCommands(this IServiceCollection services, Action<CommandsOptions> configure = null)
        {
            if (services == null)
                throw new ArgumentNullException(nameof(services));

            if (configure != null)
                services.Configure(configure);

            services.TryAddSingleton<IRegexCommandModuleProvider, RegexComandModuleProvider>();
            services.TryAddEnumerable(new ServiceDescriptor[] 
            {
                ServiceDescriptor.Transient<IHostedService, SimpleCommandHandler>(),
                ServiceDescriptor.Transient<IHostedService, RegexCommandHandler>()
            });

            return services;
        }
    }
}
{{</highlight>}}

Once you added this class, all you need to do is call `services.AddCommands();` in your `ConfigureServices` and you're good to go! This of course assumes you created a hosted discord client and added it to services as well - if you need an example, feel free to check the client created for Einherji on [GitHub](https://github.com/TehGM/EinherjiBot/tree/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.Shared/Client).

### Other
Other methods might need some more work to get this started. You'll need to manually create [RegexCommandModuleProvider](#command-module-provider) and [RegexCommandHandler](#regex-command-handler) and `IServiceProvider`. You might need to remove `ILogger` and `IOptionsMonitor` from [RegexCommandHandler constructor](#regexcommandhandler-constructor-and-properties), or figure out a way to create them without [.NET Generic Host](https://docs.microsoft.com/en-gb/aspnet/core/fundamentals/host/generic-host?view=aspnetcore-3.1) - but I'll leave that up to you.

## Summary
Whoa, was this a journey! I won't say it will be easy for everyone to add this, but it's not as difficult as it might initially seem. Yes, there was a fair amount of components and reflection needed, and it might not be 100% perfect, but well, it works!

But most importantly, that was a good learning experience - exactly what I needed before creating my own commands system for [Wolfringo](https://github.com/TehGM/Wolfringo). I hope to make it easier to extend than Discord.Net's system without making it harder to use - but we'll see once I actually do it!

As I mentioned before - you can find full implementation of the Regex Commands System on [GitHub in EinherjiBot repository](https://github.com/TehGM/EinherjiBot/tree/b395ab4d27476f61e035f8350121a14a2599ac5c/EinherjiBot.Shared/CommandsProcessing).