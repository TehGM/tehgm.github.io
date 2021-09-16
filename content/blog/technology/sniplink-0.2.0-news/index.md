---
title: "Inside SnipLink v0.2.0 - News Page"
slug: sniplink-0.2.0-news
subtitle: ""
description: "SnipLink v0.2.0 released with News page feature. Let's see how it looks under the hood!"

date: 2021-09-16 19:43:21+01:00
lastmod: 2021-09-16 19:43:21+01:00
draft: false
list: true
hiddenFromSearch: false

categories: [ "Technology" ]
tags: [ "dev", "web" ]
series: [ ]

featuredImage: ""
featuredImagePreview: ""

code:
  maxShownLines: 60

featuredImage: "thumb.png"
featuredImagePreview: ""
images: [ "/blog/technology/sniplink-0.2.0-news/thumb.png" ]
---
<!--more-->

A few days ago I released [SnipLink v0.2.0](https://beta.sniplink.net/news/release-v0.2.0). The 2 biggest features include News page and Discord Integration. Today I'll talk about the former.

Warning: Quite code-heavy post. :sweat_smile:

## Why News Page?
Long story short...

Changelogs are useful for variety of reasons, and I wanted to have a changelog on SnipLink. After some thinking of how to approach it in component-oriented manner (so I it's not all mess!), I realized that publishing content like this using raw HTML, while works, would be insanely tedious - especially since I have this blog to compare with, which uses Hugo and Markdown files. I decided I want to do something similar for SnipLink, too.

And then I figured "since I am doing it markdown way, I can make actual news feature, like many actual products have". And to be honest, that's not a stupid idea - if I can get manageable markdown content files, it makes news page relatively easy.

And as such, I started developing what effectively is a simple (but powerful!) blog engine inside of my link shortener project.

## The Technicalities
So with introduction done, let's delve into the actual tech...

Note: I'll skip some implementation details, cause the idea of this post is to explain the idea, not go deep into every single line of code - not only that would be boring, but also there's tons of code that is not needed to explain that idea, so let's trim it down to specifics.

### News Entities
First off, I needed some entities to represent the posts. The general idea was to have metadata, which stores... well, metadata... and the post itself. This would allow me to skip parsing the contents of the post until it's actually opened, as well cache less in memory unless more is needed.

These entities changed a lot during the implementation course, but here's what they contain so far:

{{<highlight cs>}}
public class NewsPostMetadata
{
    public string ID { get; }
    public string FilePath { get; }
    public string Title { get; }
    public string Description { get; }
    public string ArticleThumbnailURL { get; }
    public string ListThumbnailURL { get; }
    // using razor engine is expensive. Use only if required.
    public bool UseRazorEngine { get; }
    public DateTimeOffset? Timestamp { get; }
    public DateTimeOffset? ModificationTimestamp { get; }
    public IEnumerable<string> Environments { get; }

    public object this[string key] => this._data[key];

    private readonly IDictionary<string, object> _data;

    public NewsPostMetadata(string id, string filepath, IDictionary<string, object> data)
    {
        // parse data here
    }
}

public class NewsPost
{
    public string ID => this.Metadata.ID;
    public string FilePath => this.Metadata.FilePath;
    public NewsPostMetadata Metadata { get; }
    public string HtmlContent { get; set; }
    public string MarkdownContent { get; set; }

    public NewsPost(NewsPostMetadata metadata)
    {
        if (metadata == null)
            throw new ArgumentNullException(nameof(metadata));

        this.Metadata = metadata;
    }
}
{{</highlight>}}

Okay, so some things are self explanatory, but some are less obvious - so let me explain them:
- `data` in **NewsPostMetadata** constructor is the output of YAML parser - read more below!
- Article and List thumbnails are separate, because I noticed that some thumbnails look bad when "shrunk" on the posts list. But don't worry - the constructor actually checks `data` for "thumbnail" and uses it for both, and only then overwrites the specific ones.
- `UseRazorEngine` is a switch to enable or disable [Razor parsing support](#razor) - as comment says, it can be expensive, so it's enabled only for content that actually needs it.
- Features need testing, and since I am using .md files, they get output to the server. `Environments` prevents that. News Provider checks this collection - if it's empty, the post is included everywhere, but if it's "Beta" and "Production", only Beta and Production servers will display this post.
- Both `HtmlContent` and `MarkdownContent` are settable in **NewsPost** - this is so they can be lazy loaded when needed, and no sooner than that.

### Markdown
The most important step was to get markdown working. I began where every programmer goes the most often - with Google!  
Very quickly I found a special library [Westwind.AspNetCore.Markdown](https://github.com/RickStrahl/Westwind.AspNetCore.Markdown) for ASP.NET Core that does just that - Markdown support. It also offers it quite out of the box. So yeah, that's it, install it, and have a news engine, right?

Well, no.  
While this library seems all good, I quickly found that it does just too much "out of the box" for my liking. For that reason, I'd have to configure it a ton to work for my liking. The simpler approach for my use case would be use [Markdig](https://github.com/xoofx/markdig) parser (which Westwind.AspNetCore.Markdown used itself, actually), and then build on top of it.

So, I installed it, and created a really minimalistic service, that simply abstracts the call to Markdig.

{{<highlight cs>}}
public interface IMarkdownProvider
{
    string Parse(string markdown);
}

public class MarkdownProvider : IMarkdownProvider
{
    private readonly MarkdownPipeline _pipeline;

    public MarkdownProvider()
    {
        this._pipeline = new MarkdownPipelineBuilder()
            .UseAdvancedExtensions()
            .Build();
    }

    public string Parse(string markdown)
        => Markdown.ToHtml(markdown, this._pipeline);
}
{{</highlight>}}

### YAML
Markdown is great for post body, but news need the metadata, as well. Just like with Hugo, this is where YAML comes in.

YAML support is actually really similar to Markdown support. I found a nice working library called [YamlDotNet](https://github.com/aaubry/YamlDotNet) - and like with Markdown, I created a minimal service to abstract it:

{{<highlight cs>}}
public interface IYamlProvider
{
    T Parse<T>(string yaml);
}

public class YamlProvider : IYamlProvider
{
    private readonly IDeserializer _deserializer;

    public YamlProvider()
    {
        this._deserializer = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .Build();
    }

    public T Parse<T>(string yaml)
        => this._deserializer.Deserialize<T>(yaml);
}
{{</highlight>}}

### Razor
One thing I really like with ASP.NET Core Razor Pages is how seemlessly I can use C# within my page code. For that reason I wanted to have that for my News page as well.

To achieve this... well, you know the drill already - found and installed a library ([RazorEngine](https://github.com/Antaris/RazorEngine) in this case) and created a service class:

{{<highlight cs>}}
public interface IRazorProvider
{
    string Render<T>(string id, string content, T model);
}

public class RazorProvider : IRazorProvider
{
    private readonly IRazorEngineService _razor;

    public RazorProvider()
    {
        TemplateServiceConfiguration config = new TemplateServiceConfiguration();
        config.Language = Language.CSharp;
        config.EncodedStringFactory = new HtmlEncodedStringFactory();

        this._razor = RazorEngineService.Create(config);
    }

    public string Render<T>(string id, string content, T model)
    {
        if (model == null)
            return _razor.RunCompile(content, id, null, null, null);
        else
            return _razor.RunCompile(content, id, typeof(T), model, null);
    }
}

public static class RazorProviderExtensions
{
    public static string Render(this IRazorProvider provider, string id, string content)
        => provider.Render<object>(id, content, null);
}
{{</highlight>}}

{{<admonition warning>}}
An important note here - enabling Razor engine for posts is not only expensive (since why I added a [switch](#news-entities) so posts requiring it can opt-in), it can also be dangerous, as it basically allows posts to execute any C# code within your web application - eeep!

For SnipLink I am the only author, so it's fine. But if you want to build something where users can post their own content, you really ***SHOULD NOT*** add this.
{{</admonition>}}

### News Provider
Now time for the beast that glues all the pieces together. News Provider is responsible for loading all the files, splitting the contents, calling the other components, caching and finally returning the posts. That's a lot, so let's break it down into separate steps.

##### Finding Files
The idea behind deciding what files to load is was similar to Hugo - post can be either a `.md` file in `/news/` directory, or a folder that contains `index.md` and other optional files (such as images). Then, either the file name (for the former) or folder name (for the latter) will be considered a post ID - the one you see in the URL.

{{<highlight cs>}}
private async Task LoadAllPostsMetadataAsync()
{
    // skip loading anything if already loaded
    if (this._allPostsMetadata != null)
        return;

    // load paths of valid files and folders
    IEnumerable<string> files = Directory.GetFiles(this.NewsFolderPath, "*.md", SearchOption.TopDirectoryOnly);
    IEnumerable<string> folders = Directory.GetDirectories(this.NewsFolderPath, "*", SearchOption.TopDirectoryOnly)
        .Where(f => File.Exists(GetFilePathForFolder(f)));
    this._allPostsMetadata = new Dictionary<string, NewsPostMetadata>(files.Count() + folders.Count(), StringComparer.OrdinalIgnoreCase);
    
    // files use their name as ID
    foreach (string f in files)
    {
        string id = Path.GetFileNameWithoutExtension(f);
        await this.LoadPostMetadataAsync(id, f).ConfigureAwait(false);
    }
    // folders use their name as ID, and index.md as actual data file
    foreach (string f in folders)
    {
        string id = Path.GetFileName(f);
        await this.LoadPostMetadataAsync(id, GetFilePathForFolder(f)).ConfigureAwait(false);
    }
}
{{</highlight>}}

And, class methods used by snippet above:

{{<highlight cs>}}
private string GetFilePathForFolder(string folderPath)
    => $"{folderPath}/index.md";

private string NewsFolderPath
    => Path.Combine(this._environment.WebRootPath, "news");
{{</highlight>}}

So, as you can see, there's no magic going on there. Just a few clever but simple IO operations. Let's go to the next step.

##### Loading Files
You can notice a call to `LoadPostMetadataAsync` in the snippets above. This is the method that deals with reading the post file and parsing metadata. Let's cover the first step.

Just like previous step, this one is nothing special, either. Merely some everyday IO code.

{{<highlight cs>}}
async Task LoadPostMetadataAsync(string id, string filePath)
{
    string postData = await this.LoadPostFileAsync(filePath).ConfigureAwait(false);
    // other code (covered later)
}

private async Task<string> LoadPostFileAsync(string path)
{
    if (!File.Exists(path))
        throw new FileNotFoundException("Specified news post file not found", path);
    using FileStream stream = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.Read);
    using StreamReader reader = new StreamReader(stream);
    string result = await reader.ReadToEndAsync().ConfigureAwait(false);
    if (string.IsNullOrWhiteSpace(result))
        throw new InvalidDataException($"Null data loaded for news post {path}");
    return result;
}
{{</highlight>}}

##### Loading Metadata
Now to the first actually interesting part - parsing our YAML metadata.

There are a few things we need to establish:
- YAML starts and ends with `---` - in code, I named the variable `yamlSeparator` cause I am bad at naming.
- YAML data is effectively a dictionary, with string keys and anything values - so we'll use just that.
- Every post needs yaml block, and title and timestamp inside, otherwise it's considered invalid.
- Loaded metadata is cached forever, so it can be easily reaused by the application.

{{<highlight cs>}}
private const string yamlSeparator = "---";

private async Task LoadPostMetadataAsync(string id, string filePath)
{
    this._log.LogTrace("Loading news post metadata from {Path}", filePath);
    string postData = await this.LoadPostFileAsync(filePath).ConfigureAwait(false);

    if (!postData.StartsWith(yamlSeparator, StringComparison.Ordinal))
        throw new InvalidDataException($"News post {filePath} doesn't start with a valid YAML metadata block");

    // parse yaml
    string yamlRaw = postData.Substring(yamlSeparator.Length, this.GetYamlEndIndex(postData, filePath) - yamlSeparator.Length).Trim();
    // copy to a new dictionary so we can make 
    IDictionary<string, object> data = new Dictionary<string, object>(
        this._yaml.Parse<IDictionary<string, object>>(yamlRaw), StringComparer.OrdinalIgnoreCase);
    // off-load parsing keys to metadata constructor
    NewsPostMetadata metadata = new NewsPostMetadata(id, filePath, data);

    if (string.IsNullOrWhiteSpace(metadata.Title) || metadata.Timestamp == null)
    {
        using IDisposable logScope = this._log.BeginScope(new Dictionary<string, object>
            {
                { "yaml", yamlRaw },
                { "Post.ID", metadata.ID },
                { "Post.Title", metadata.Title },
                { "Post.Timestamp", metadata.Timestamp },
                { "Post.UseRazorEngine", metadata.UseRazorEngine }
            });
        this._log.LogError("News post {ID} has malformed YAML metadata block: needs both title and timestamp", metadata.ID);
        return;
    }

    // add to cache - only cache if can be shown in current environment
    if (metadata.ShowInEnvironment(this._environment))
        this._allPostsMetadata.Add(id, metadata);
}

private int GetYamlEndIndex(string postData, string path)
{
    int yamlEndIndex = postData.IndexOf(yamlSeparator, yamlSeparator.Length, StringComparison.OrdinalIgnoreCase);
    if (yamlEndIndex < yamlSeparator.Length)
        throw new InvalidDataException($"News post {path} has malformed YAML metadata block");
    return yamlEndIndex;
}
{{</highlight>}}

What's worth noting is the `ShowInEnvironment` method - that method is in the metadata class itself, and simply determines if the post should appear in given environment (Development, Beta, Production etc).

{{<highlight cs>}}
public bool ShowInEnvironment(IHostEnvironment env)
{
    // environment not specified == simply available as-is
    if (this.Environments?.Any() != true)
        return true;

    // check if should be shown in current env
    foreach (string allowedEnvironment in this.Environments)
    {
        if (env.IsEnvironment(allowedEnvironment))
            return true;
    }
    return false;
}
{{</highlight>}}

More interesting, but still not that hard, eh? Let's go to the next step!

##### Caching
So when we load metadata, we cache it, as we can see in the snippet above. We also cache the loaded `NewsPost` later. But how do we achieve it?

Caching of metadata is simple. Because for now I have small amount of posts, I can afford to cache it for the app's lifetime. And for that, something as simple as a dictionary is more than enough - and we can actually see it as we are [looking for files](#finding-files):

{{<highlight cs "hl_lines=5">}}
// ...
IEnumerable<string> files = Directory.GetFiles(this.NewsFolderPath, "*.md", SearchOption.TopDirectoryOnly);
IEnumerable<string> folders = Directory.GetDirectories(this.NewsFolderPath, "*", SearchOption.TopDirectoryOnly)
    .Where(f => File.Exists(GetFilePathForFolder(f)));
this._allPostsMetadata = new Dictionary<string, NewsPostMetadata>(files.Count() + folders.Count(), StringComparer.OrdinalIgnoreCase);
// ...
{{</highlight>}}

How about caching the posts themselves? Well, since we want that cache to be cleared at some point, SnipLink uses another solution. I created a relatively simple cache mechanism, that also uses dictionary under the hood, but also checks expiration time and removes expired beings from the memory every time the cache is used in any way.  
The actual implementation is out of scope for this blog post, but just so you know what's being called in the code below, here's the interface and extension methods:

{{<highlight cs>}}
public interface IEntityCache<TKey, TEntity>
{
    int CachedCount { get; }

    void AddOrReplace(TKey key, TEntity entity, DateTime expirationTimeUTC);
    bool TryGet(TKey key, out TEntity entity);
    IEnumerable<TEntity> Find(Func<CachedEntity<TKey, TEntity>, bool> predicate);
    void Remove(TKey key);
    void Clear();
}

public static class EntityCacheExtensions
{
    public static void AddOrReplace<TKey, TEntity>(this IEntityCache<TKey, TEntity> cache, TKey key, TEntity entity, TimeSpan lifetime)
        => cache.AddOrReplace(key, entity, DateTime.UtcNow + lifetime);

    public static IEnumerable<TEntity> Find<TKey, TEntity>(this IEntityCache<TKey, TEntity> cache, Func<TEntity, bool> predicate)
        => cache.Find((i) => predicate(i.Entity));

    public static TEntity Get<TKey, TEntity>(this IEntityCache<TKey, TEntity> cache, TKey key)
    {
        cache.TryGet(key, out TEntity result);
        return result;
    }
}
{{</highlight>}}

##### Loading Post Body
Now to the arguably most important part of entire loading process - the post body.

{{<highlight cs>}}
public async Task<NewsPost> GetNewsPostAsync(string id, bool includeContent)
{
    id = id.Trim().ToLowerInvariant();
    NewsPost result;

    // if not found in cache, grab metadata and create a new post entry
    if (!this._cache.TryGet(id, out result))
    {
        await this.GetAllNewsAsync().ConfigureAwait(false);
        if (!this._allPostsMetadata.TryGetValue(id, out NewsPostMetadata metadata))
            return null;

        result = new NewsPost(metadata);
        if (!metadata.ShowInEnvironment(this._environment))
            return null;
    }

    // parse markdown content
    if (includeContent && string.IsNullOrWhiteSpace(result.HtmlContent))
        await this.PopulateHtmlContentAsync(result);

    this._cache.AddOrReplace(id, result, this._options.CurrentValue.CacheLifetime);
    return result;
}
{{</highlight>}}

This is actually... really simple, eh? It's basically self explanatory - well, maybe with 1 little detail:  
`includeContent` allows this method to be called to get post without loading the content - effectively grabbing metadata only. This currently isn't used though - I could probably remove it.

Now, to the 2nd part of this - `PopulateHtmlContentAsync`:

{{<highlight cs>}}
private async Task PopulateHtmlContentAsync(NewsPost post)
{
    string postData = await this.LoadPostFileAsync(post.FilePath).ConfigureAwait(false);
    string contentRaw = postData.Substring(this.GetYamlEndIndex(postData, post.FilePath) + yamlSeparator.Length).Trim();
    if (string.IsNullOrWhiteSpace(contentRaw))
        throw new InvalidDataException($"News post {post.FilePath} has no content");

    if (post.Metadata.UseRazorEngine)
    {
        this._log.LogTrace("Running Razor Engine on post {Path}", post.FilePath);
        contentRaw = this._razor.Render(post.ID, contentRaw);
    }

    post.HtmlContent = this._markdown.Parse(contentRaw);
    post.MarkdownContent = contentRaw;
}
{{</highlight>}}

This method reuses the `LoadPostFileAsync` method I have shown when we were [loading files](#loading-files). Then it skips all the YAML, as it's only interested in markdown body.

When all markdown is loaded, it optionally runs [Razor Engine](#razor) on the content. After that, it finally uses [Markdown parser](#markdown) and stores HTML output in post entry. As a bonus, it also stores markdown content.  
Why? SnipLink API allows retrieving post as both HTML and Markdown.
Why? Because it can, why not?

##### Additional Methods
Well, we covered the core of News Provider. That's all the cool stuff it does to generate the posts.  
But there are also 3 small bonus methods that are quite useful.

{{<highlight cs>}}
public async Task<int> GetPagesCountAsync()
{
    NewsOptions options = this._options.CurrentValue;
    double pageSize = options.PostPerPage;
    double count = (await this.GetAllNewsAsync().ConfigureAwait(false)).Count();
    if (this._environment.IsDevelopment())
        count *= options.MultiplyPosts;
    return (int)Math.Ceiling(count / pageSize);
}

public async Task<IEnumerable<NewsPostMetadata>> GetNewsPageAsync(int page)
{
    NewsOptions options = this._options.CurrentValue;
    uint pageSize = options.PostPerPage;
    uint skipCount = ((uint)page - 1) * pageSize;
    IEnumerable<NewsPostMetadata> results = await this.GetAllNewsAsync().ConfigureAwait(false);
    return results.OrderByDescending(metadata => metadata.Timestamp.Value)
        .Skip((int)skipCount).Take((int)pageSize);
}

public async Task<IEnumerable<NewsPostMetadata>> GetAllNewsAsync()
{
    await this.LoadAllPostsMetadataAsync().ConfigureAwait(false);
    return this._allPostsMetadata.Values;
}
{{</highlight>}}

All of them are pretty simple, but each quite useful:
- `GetPagesCountAsync` is used to build navigation on the posts list page.
- `GetNewsPageAsync` is used to get paginated entries to display on posts list page.
- `GetAllNewsAsync` is used to generate *sitemap.xml*.

### Displaying Posts
Both [/news/](https://beta.sniplink.net/news) list page and [actual post](https://beta.sniplink.net/news/release-v0.2.0) article page are simple Razor .cshtml pages. They contain more HTML than C# code - with some small exceptions (like generating navigation on posts list page), they merely iterate over and plug C# `NewsPost` and `NewsPostMetadata` variables into HTML. For this reason, I'll only cover the page models - but they're pretty simple too!

*NewsList.cshtml.cs* (`@page "/news"`):
{{<highlight cs>}}
public class NewsListModel : PageModel
{
    private readonly INewsProvider _newsProvider;

    public int CurrentPage { get; private set; }
    public int TotalPages { get; private set; }
    public IEnumerable<NewsPostMetadata> Posts { get; private set; }

    public NewsListModel(INewsProvider newsProvider)
    {
        this._newsProvider = newsProvider;
    }

    public async Task<IActionResult> OnGetAsync([FromQuery]int page = 1)
    {
        if (page < 1)
            page = 1;

        this.CurrentPage = page;

        IEnumerable<NewsPostMetadata> posts = await this._newsProvider.GetNewsPageAsync(this.CurrentPage).ConfigureAwait(false);
        if (posts?.Any() != true)
            return NotFound();

        this.Posts = posts;
        this.TotalPages = await this._newsProvider.GetPagesCountAsync().ConfigureAwait(false);
        if (this.CurrentPage == 1)
            base.ViewData.SetTitle("News");
        else
            base.ViewData.SetTitle("News Directory - Page " + this.CurrentPage);
        base.ViewData[ViewDataKeys.AddNewsCSS] = true;
        return Page();
    }
}
{{</highlight>}}

*NewsEntry.cshtml.cs* (`@page "/news/{id}"`):
{{<highlight cs>}}
public class NewsEntryModel : PageModel
{
    private readonly INewsProvider _newsProvider;

    public NewsPost CurrentPost { get; private set; }
    public uint ReturnPageNumber { get; private set; }

    public NewsEntryModel(INewsProvider newsProvider)
    {
        this._newsProvider = newsProvider;
    }

    public async Task<IActionResult> OnGetAsync(string id, uint returnPage = 1)
    {
        if (returnPage < 1)
            returnPage = 1;

        if (string.IsNullOrWhiteSpace(id))
            return BadRequest();

        NewsPost post = await this._newsProvider.GetNewsPostAsync(id, true).ConfigureAwait(false);
        if (post == null)
            return NotFound();

        this.CurrentPost = post;
        this.ReturnPageNumber = returnPage;
        base.ViewData.SetTitle($"News - {this.CurrentPost.Metadata.Title}");
        base.ViewData.SetDescription(this.CurrentPost.Metadata.Description);
        base.ViewData[ViewDataKeys.AddNewsCSS] = true;

        // for twitter cards (to use within Discord embeds etc)
        string cardThumbnail = this.CurrentPost.Metadata.ArticleThumbnailURL ?? this.CurrentPost.Metadata.ListThumbnailURL;
        if (!string.IsNullOrWhiteSpace(cardThumbnail))
        {
            if (!cardThumbnail.StartsWith('/') && !cardThumbnail.StartsWith("http"))
                cardThumbnail = $"/news/{this.CurrentPost.ID}/{cardThumbnail}";
            base.ViewData.SetThumbnailURL(cardThumbnail); 
            base.ViewData.SetTwitterCardType("summary_large_image");
        }

        return Page();
    }
}
{{</highlight>}}

See? Told you they were easy.

The only thing worth noting are methods like `ViewData.SetTitle`. They're simple extensions I created to avoid using magic strings when accessing ViewData:
{{<highlight cs>}}
public static class ViewDataDictionaryExtensions
{
    // TITLE
    public static void SetTitle(this ViewDataDictionary viewData, string value)
        => viewData[ViewDataKeys.Title] = value;
    public static string GetTitle(this ViewDataDictionary viewData)
        => viewData[ViewDataKeys.Title] as string;
    public static bool TryGetTitle(this ViewDataDictionary viewData, out string value)
        => TryGetViewDataValue(viewData, ViewDataKeys.Title, out value);

    // ... others ...

    private static bool TryGetViewDataValue<T>(ViewDataDictionary viewData, string key, out T value)
    {
        if (viewData.TryGetValue(key, out object valueObj) && valueObj is T valueCasted)
        {
            value = valueCasted;
            return true;
        }
        value = default;
        return false;
    }
}

public static class ViewDataKeys
{
    public const string Title = "Title";
    // ... others ...
}
{{</highlight>}}

## What else?
SnipLink also has API Endpoint which is nothing special - it merely calls the services I have shown above and wraps output in a model class (to not expose things might not want to expose) - nothing more, really. All hail SOLID and Dependency Injection!

Now a few notes - this solution is not perfect, and I am aware of that. There are a few issues.

Because it operates on markdown files, any change to post, even a typo fix, means redeployment of the application (or editing the file on the server). It's not that huge of a deal for me as I automated SnipLink deployment, however it still is not perfect.  
Long term goal is to store the posts in database. However to do this any conveniently it requires some nice in-page editor with authentication system, or at least some ad-hoc uploader - because of that, I figured I'll go with files first.

Another problem is that in-memory caching could get RAM-heavy as news list grows. For this reason caching might need to be disabled later, and database approach would also help a bit here. But again - that's a problem for later. Current solution is easy enough to alter, so I am not worried at all.

One significant issue would be the security concerns of Razor Engine use for pages that allow user-submitted content. That said, it's not a problem for SnipLink - and if you want to use this blog as a guide, remember - *do* ***NOT*** *enable Razor Engine support if users can submit content*!

## Summary
As you can see, building news feature - which effectively is a blog engine! - wasn't actually hard, thanks to existing libraries.

What's really nice is that since I created this solution by myself, on top of quite customizable Markdown library, I can alter it to my needs as I go.

Do I plan to adapt this to this blog? Hell no. Hugo is designed for blogging and is amazing for it, and my blog is static, too - I stick with Hugo.  
However for a dynamic server-based page like SnipLink that only needs news post - this solution is really good, and powerful enough to perfectly fit my needs.