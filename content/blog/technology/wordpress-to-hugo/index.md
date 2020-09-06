---
title: "Migrating from Wordpress to Hugo"
slug: wordpress-to-hugo
subtitle: ""
description: "The journey of migrating this blog from Wordpress CMS to Hugo static page builder"

date: 2020-09-06T12:28:59+02:00
lastmod: 2020-09-06T12:28:59+02:00
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
lightgallery: false
---

Recently I migrated this very blog from Wordpress to Hugo. It wasn't a hard task, nor it was a very long one - but still I encountered some challenges, so I decided to document that. Plus when a change like this happens, some explanation is needed anyway.

<!--more-->

## Why migrate?
### Subdomain

Originally I hosted this blog on [blog.tehgm.net](https://blog.tehgm.net/) subdomain. While subdomains look cool, I wanted blog and ['home page'](https://tehgm.net) to be a related entity. Unfortunately, I read at multiple sources that Google considers subdomain and root domain to be separate entities. And this honestly makes sense - but unfortunately is not perfect for my use cases, and is bad for SEO.

With Hugo, I can easily have both in same place - granted, Wordpress allows that too, but with next limitations I am about to mention

### Slow hosting

I used free tier of [AwardSpace](https://www.awardspace.com/) to host the blog. I didn't want to have running cost of the website, because I knew it'll not be visited often (especially in the beginning), and I am not really a blogging person, so I didn't see myself maintaining it very frequently.

The problem with free hosting is that it was terribly slow. Page was taking ages to load, and sometimes it was refusing to load at all cause there was even minimal traffic. And it wasn't just [AwardSpace](https://www.awardspace.com/) thing. I tried multiple different free PHP hosts, like [InfinityFree](https://infinityfree.net/), [Byet Host](https://byet.host/) or others, and while many looked better on paper, in my experience, they performed worse in my experience.

Hugo allows me to host the website almost everywhere, including free [GitHub Pages](https://pages.github.com/) - which not only performs much faster, but also has SSL Cert out of the box, and is fully integrated with GitHub (which as a developer, I use daily).

### Customizability

Wordpress is a full CMS solution, which is great for many less programming-inclined individuals. But I'm not one of them. I program daily, I do it for hobby, and I do it for living. And because of that, Wordpress (especially hosted on a free hosting service) felt really limiting to me. As a CMS solution, Wordpress is huge, modifying it gets painful. I tried to use some plugins such as Elementor to expand my possibilities, but I still felt cuffed. I didn't like it at all. That was my main issue with it.

Hugo on other hand, is extremely flexible. Even when I install a theme, I can really easily build whatever I want. All the limits I felt with Wordpress are gone - whatever bothers me, I can work around somehow.

### But why Hugo?

Hugo isn't the only static page generators. There are others, for example Gatsby or Jekyll (which I actually used to build [BloodXtract Team website](https://bloodxtract.com)).

Hugo and Gatsby looked to be much more powerful than Jekyll - and it's no surprise, they both are much younger. And when I was choosing between them, I was looking at themes available. What made me choose Hugo over Gatsby was [LoveIt theme](https://github.com/dillonzq/LoveIt) - it looked almost exactly like what I want to start with - and because it's Hugo, any further customization I need is easy.

## Getting site up
### First steps

First step was installing hugo. The best way to do it is installing [Chocolatey](https://chocolatey.org/install) and then run `choco install hugo-extended -confirm` command. Hugo can be installed by downloading binary and setting a PATH variable, but I couldn't find information whether it's Hugo Extended or normal one - so to be sure, I chose Chocolatey. Check [Hugo docs](https://gohugo.io/getting-started/installing) for more info on installing Hugo.

Then I created a repository named `tehgm.github.io` on GitHub. Once I did that, I cloned the repo to my local drive, and ran `hugo new site tehgm.github.io` to create initial files. I also updated `.gitignore` file with with snippet from [gitignore.io](https://www.toptal.com/developers/gitignore/api/hugo).

### Installing LoveIt theme

LoveIt theme can be installed in multiple ways. However, to be sure no updates are automatic and ruin my changes, I downloaded zip of [release 0.2.10](https://github.com/dillonzq/LoveIt/releases/tag/v0.2.10) which was latest at the time, and extracted it to `/themes/` directory. Once theme was unpacked, I configured `config.toml` by following installation guide on theme's [website](https://hugoloveit.com/theme-documentation-basics/#basic-configuration). I disabled some features I didn't need, changed CSS a little bit etc, and initial site was ready.

### Automatic deployment

[Hugo documentation](https://gohugo.io/hosting-and-deployment/hosting-on-github/) suggests writing a script to deploy the built page to GitHub. However it is an additional step that I need to take from local machine - less than perfect. GitHub supports [Actions](https://github.com/features/actions) to automate tasks, so I decided to take advantage of it.

For nearly all my projects, I use at least 2 git branches - master and dev. Master is latest release, while dev (and ofc sometimes feature branches etc) is where I tweak code. This is also a perfect setting for automatic deployments - whenever I push to master branch, I want my site to be built and published.

The action code is simple thanks to [Action written by peaceiris](https://github.com/peaceiris/actions-hugo). Using his Hugo action, I created following action which automates my website deployments:
{{<highlight yaml>}}
name: Hugo Deploy

on:
  push:
    branches: [ master ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-18.04

    steps:
      - name: Checkout
        uses: actions/checkout@v2
        with:
          submodules: true
          fetch-depth: 0

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: '0.74.3'
          extended: true

      - name: Build
        run: hugo --minify
        
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
{{</highlight>}}

## Migrating Wordpress content

Once site was up, it was time to migrate the actual content from Wordpress website. This required several steps:

### Importing posts

Hugo lists few tools to automate migration in its [documentation](https://gohugo.io/tools/migrations/#wordpress).

First one is [wordpress-to-hugo-exporter](https://github.com/SchumacherFM/wordpress-to-hugo-exporter). Unfortunately this didn't work for me - AwardSpace's web-based file manager does not allow uploading zip files for free tiers, and FileZilla completely refused to connect to the server for some reason - *yet another reason to migrate to Hugo*! As an alternative, I could set up a local wordpress instance on my own computer, but that's more effort than it was worth.

Second tool was Python-based [ExitWP for Hugo](https://github.com/wooni005/exitwp-for-hugo). This tool worked... after I uninstalled Python installations of any 3.X version. The tool itself is simple - go to Wordpress admin panel, export XML, put it in `wordpress-xml` folder, and run the tool.
{{<admonition type=tip title="Note">}}
When I exported all Wordpress contents to XML, the tool spew a lot of errors. However when I exported posts only, it worked fine.
{{</admonition>}}

The tool gave me a set of `.markdown` files. I changed extensions of every single one to `.md` (I did it manually as I only had 5 posts), removed date prefix from file name, and dropped in blog folder of my website. I also removed few properties from front matter that I did not need - such as Author, for example.

### Fixing notes

In my IMO post about [Game of Thrones]({{<ref "/blog/imo/game-of-thrones" >}} "IMO: Game of Thrones") I used a note box with spoiler warning. The tool didn't export it as such, and put it as a normal text. To fix that, I used [Admonition shortcode](https://hugoloveit.com/theme-documentation-extended-shortcodes/#4-admonition) provided by LoveIt theme. The theme provides a fair variety of the boxes, so it was an easy fix - virtually no HTML or custom Markdown was needed. Yay!

### Fixing images

[ExitWP](https://github.com/wooni005/exitwp-for-hugo) failed to import images from blog posts, and left something like this instead:
{{<figure src="screenshot1.png">}}

Fixing this error was quite manual, but for a really small blog, it wasn't a big problem. First, I turned blog posts that have any images into folders. Then I copied every image from old blog and pasted into posts' folders, renaming the files into something simple. Then embedding the image itself was just a matter of using [image](https://hugoloveit.com/theme-documentation-extended-shortcodes/#image) or [figure](https://hugoloveit.com/theme-documentation-built-in-shortcodes/#figure) shortcodes.

### Fixing testimonials

This was the largest code effort of the entire migration process. On Wordpress blog, I used one of Elementor's testimonial widgets to show a summary of my IMO posts. Unfortunately, after import they were completely broken:
{{<figure src="screenshot2.png">}}

Neither Hugo nor LoveIt theme had testimonials built-in, so I had to experiment with HTML and CSS to design one, and learn how to create custom shortcodes with Hugo. Thankfully it was rather simple, and the code for such widget isn't huge, either:
{{<highlight go-html-template>}}
{{- $inner := .Inner | .Page.RenderString -}}
{{- $image := .Get "image" | default .Site.Params.home.profile.avatarURL -}}
{{- $imageAlt := .Get "imageAlt" | default "Avatar" -}}
{{- $title := "" -}}
{{- $stars := 0 -}}

{{- if .IsNamedParams -}}
    {{- $stars = .Get "stars" | default 0 -}}
    {{- $title = .Get "title" -}}
{{- else -}}
    {{- $stars = .Get 0 | default 0 -}}
    {{- $title = .Get 1 -}}
{{- end -}}

<div class="testimonial">
    <div class="image-container">
        <img src="{{ $image }}" alt="{{ $imageAlt }}" />
    </div>
    <div class="content">
        {{- if $title -}}
            <h2>{{ $title }}</h2>
        {{- end -}}
        <p>{{ $inner }}</p>
        {{- if ne $stars 0 -}}
            <div class="stars">
                {{- range $i, $sequence := (seq 5) -}}
                    {{- $s := (add $i 1) -}}
                    {{- if or (lt $s $stars) (eq $s $stars) -}}
                        <span class="fas fa-star"></span>
                    {{- else if lt $s (add $stars 1) -}}
                        <span class="fas fa-star-half-alt"></span>
                    {{- else -}}
                        <span class="far fa-star"></span>
                    {{- end -}}
                {{- end -}}
            </div>
        {{- end -}}
    </div>
</div>
{{</highlight>}}
{{<highlight sass>}}
.testimonial {
    position: relative;
    display: flex;
    flex-direction: row;
    margin: 20px 10px;
}

.testimonial .image-container {
    width: 25%;
    text-align: center;
    flex-basis: content;
    flex-shrink: 0;
    margin-right: 20px;
}

.testimonial img {
    border-radius: 42%;
    width: 150px;
    border-style: solid;
    margin: 0;
}

.testimonial .content {
    width: 75%;
    word-break: break-word;

    .stars {
        margin-top: 15px;
        font-size: 33px;
        text-align: center;

        span + span {
            margin-left: 10px;
        }
    }
}
{{</highlight>}}

I am really happy with the result. Not only the looks fit the current page style, I also added support for half stars (whereas Wordpress widget only supported full stars). And since I am in charge of the code for the widget, if I ever need to change the max stars count, it's just a matter of changing one variable. Usage is also really simple:
{{<highlight go-html-template "linenos=false">}}
{{</*testimonial stars=4 title="My opinion?"*/>}}
    <!-- Comment goes here -->
{{</*/testimonial*/>}}
{{</highlight>}}
{{<figure src="screenshot3.png" caption="The custom testimonial code output">}}

### Redirects

I opted to not include blog categories in URL, except for [IMO posts]({{<ref "/categories/imo">}}). However my Wordpress blog did include categories by default.

Fortunately Hugo supports aliases out of the box - and they're simple to use as well: https://gohugo.io/content-management/urls/#aliases. With this feature, adding a redirect for every old post was a simple task.

I still needed to redirect from `blog.tehgm.net` to `tehgm.net/blog` - here CloudFlare's Page Rules came in. They support wildcards, and contents of these wildcards can be input into redirection URL. Setting them is simple as well:
{{<figure src="screenshot4.png">}}

## Summary

Now that my blog is migrated from Wordpress, I no longer feel as limited as I did before. It's much faster and I can easily customize almost anything I need to customize.

This blog post doesn't cover every single step I did - I also changed the [blog listing page]({{<ref "/blog/">}}) to look more like [theme's home page](https://hugoloveit.com/), rather than trimmed down [default posts page](https://hugoloveit.com/posts/), and did a few other changes. However these changes aren't necessarily migration per se - they're customizations, and therefore I skip them in this already lengthy (by my standards) post.

Of course my work on this site is not done yet - I will for sure want to add more sub-pages, add some other customizations and change styling at least a little bit to make my page a bit more unique. But right now, I am not tied to Wordpress limitations - and damn, does that feel good.