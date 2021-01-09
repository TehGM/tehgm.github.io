---
title: "DocFX automation with GitHub Actions"
slug: docfx-github-actions
subtitle: ""
description: "Let me show you how to automate publishing a DocFX documentation page using GitHub Actions"
date: 2020-12-18T17:44:02+01:00
lastmod: 2020-12-18T17:44:02+01:00
draft: false
list: true
hiddenFromSearch: false
type: blog

categories: [ "Technology" ]
tags: [ "guide", "dev", "web" ]
series: [ ]
aliases: [ ]

featuredImage: ""
featuredImagePreview: ""
lightgallery: true
fontawesome: true

code:
  maxShownLines: 10
---

Publishing a DocFX page manually each time you change it is yet another tedious step that would need to be performed during release. Recently I was releasing v1.0.0 of my [Wolfringo](https://github.com/TehGM/Wolfringo) library, and I set up automated publishing using GitHub Actions!
<!--more-->

## What is DocFX?
[DocFX](https://dotnet.github.io/docfx/) is a static page generator that generates HTML from Markdown files. What differentiates it from generators like [Hugo]({{<ref "/blog/technology/wordpress-to-hugo/index.md" >}}) or Jekyll is that it's designed specifically for code documentation, and as such, it generates API Reference from comments in the source code of your project. Neat, huh?

DocFX promises to support multiple languages, including C#, F#, Visual Basic, REST, JavaScript, Java, Python and TypeScript

DocFX is maintained by Microsoft - in fact, I believe [Microsoft Docs](https://docs.microsoft.com) are also largely generated with DocFX.

## What are GitHub Actions
[GitHub Actions](https://github.com/features/actions) are CI/CD workflows that are integrated directly into your GitHub repository. They can be ran manually or automatically on certain events (such as push to a branch or a Pull Request being opened). If Action is triggered by a Pull Request, GitHub will automatically start the action, and will prevent merging the PR until all actions are successful (unless you're an admin on the repository - then you can force merge). 

GitHub Actions are free to use for public repositiories.

I find GitHub Actions really useful for automatically publishing websites from source, such as Hugo or DocFX projects. Publishing Hugo I deeply covered in my post about [Migrating this page from Wordpress to Hugo]({{<ref "/blog/technology/wordpress-to-hugo/index.md#automatic-deployment">}}), so let's focus on DocFX here!

## Creating a DocFX Action
There's an existing [docfx-action](https://github.com/marketplace/actions/docfx-action) by *[nikeee](https://github.com/nikeee)*, however I had an issue getting it to work with my .NET Core/.NET Standard project - I assume it'd be because that action uses Mono under the hood. After trying to get it to work for a longer while, I decided to write my own action that handles DocFX.

### Requirements
I assume that you already have your DocFX files set up, and your project code ready and commented with `///` comments. Writing these is a larger topic and out of scope of this blog post - if you need help, please refer to [DocFX tutorials](https://dotnet.github.io/docfx/tutorial/docfx_getting_started.html) and [XML documentation comments guide](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/xmldoc/).

I also recommend that you work on minimum 2 branches with your project - master and dev. While this isn't strictly required for your DocFX action to work, but working on dev and pushing to master only for release can be used to limit your documentation re-publishing to only when a release is actually ready. Plus, not working on a master branch directly is considered to be a good practice anyway.

{{<admonition type=example title="Examples" >}}
If you'd like to see live examples, don't worry, I have these.  
[Wolfringo - IWolfClient.cs](https://github.com/TehGM/Wolfringo/blob/master/Wolfringo.Core/IWolfClient.cs) - source code example.  
[Wolfringo - docs folder](https://github.com/TehGM/Wolfringo/tree/master/docs) - documentation config and additional Markdown files.
{{</admonition>}}

### Creating an Action file
Actions are configured as .yml files, and reside in `.github/workflows/` directory in your repository. You can create the file manually, but let's use GitHub menus to create the file in a correct location for us. In your repository, press **Actions** button. GitHub automatically suggests some pre-defined Actions templates, but for this tutorial, let's click *set up a workflow yourself* link.

{{<image src="screenshot-creating-action-1.png">}}

GitHub will display a template for a default workflow - you are welcome to edit it, or remove everything and start fresh.

#### Naming your action
Your action needs a name - you can name it whatever you want, but I suggest using a name that will help you understand what the action does just from the name alone.

{{<highlight yaml "linenostart=1">}}
name: DocFX Build and Publish
{{</highlight>}}

You probably want to rename the .yml file as well:
{{<image src="screenshot-naming-action-1.png">}}

#### Selecting when to run
Actions can be triggered by numerous events. In our example, we'll enable it for pushes and Pull Requests to master branch.
{{<highlight yaml "linenostart=3">}}
on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]
{{</highlight>}}

Of course you can use any event you want - see [Events that Trigger Workflows](https://docs.github.com/en/free-pro-team@latest/actions/reference/events-that-trigger-workflows) for a list. You can also specify more branches in the array than just master.

#### Creating a job
GitHub Actions can have multiple [jobs](https://docs.github.com/en/free-pro-team@latest/actions/reference/workflow-syntax-for-github-actions#jobs) running in parallel, or one after another if you use [needs](https://docs.github.com/en/free-pro-team@latest/actions/reference/workflow-syntax-for-github-actions#jobsjob_idneeds) option. For our example, we'll use just one job - let's name it `generate-docs`.

We'll set the job to run on Windows virtual machine - this is most sure way to get it working. There could be way to run DocFX on a Linux virtual machine, but I am not sure if it'll cause issues (due to Mono etc).

{{<highlight yaml "linenostart=9">}}
jobs:
  generate-docs:
    runs-on: windows-latest
{{</highlight>}}

#### Steps
GitHub Action job runs in steps, which always run one after another. This way, we can get everything installed etc before we build the page and publish it.  
All steps should be inside of our job object.

{{<highlight yaml "linenostart=9,hl_lines=5 6">}}
jobs:
  generate-docs:
    runs-on: windows-latest

    steps:
      # all steps go here
{{</highlight>}}

{{<admonition type=note title="Language-dependent steps">}}
In this tutorial, I use .NET Core as an example. If you use non-.NET Core language, [Step 2](#step-2---install-net-core) and [Step 4](#step-4---install-dependencies) might be different.
{{</admonition>}}

##### Step 1 - Checkout
The first step is to get all of our project code onto virtual machine. This is easy to do using predefined [checkout action](https://github.com/actions/checkout).

{{<highlight yaml "linenostart=13,hl_lines=2 3">}}
    steps:
      - name: Checkout
        uses: actions/checkout@v2
{{</highlight>}}

##### Step 2 - Install .NET Core
The 2nd step is to install .NET Core, so DocFX can build our project. Luckily there is already a predefined action for that called [setup-dotnet](https://github.com/actions/setup-dotnet), so we don't have to run series of commands.  
This action can specify which .NET Core version to install. For this example, I chose version *3.1.101*. You can pick whichever version you need with your project, or even a wildcard - refer to [setup-dotnet](https://github.com/actions/setup-dotnet) action readme.

{{<highlight yaml "linenostart=16">}}
      - name: Setup .NET Core
        uses: actions/setup-dotnet@v1
        with:
          dotnet-version: 3.1.101
{{</highlight>}}

##### Step 3 - Install DocFX
Next step is to install DocFX. The easiest way to install it in a Windows environment is using [Chocolatey](https://chocolatey.org/). We're lucky again with this one - there is already an action [ghaction-chocolatey](https://github.com/crazy-max/ghaction-chocolatey) created by *[crazy-max](https://github.com/crazy-max)* that makes using this package really easy to use with GitHub Actions.

{{<highlight yaml "linenostart=20">}}
      - name: Setup DocFX
        uses: crazy-max/ghaction-chocolatey@v1
        with:
          args: install docfx
{{</highlight>}}

##### Step 4 - Install dependencies
Now we have all software installed. Time to install all NuGet packages that our projects use. If we don't do this, there might be issues generating some cross-links for your automatically generated API Reference. For example, I had issues with any links to methods that take `CancellationToken` as one of their parameters.  
To install dependencies, we simply run `dotnet restore` command in the step:
{{<highlight yaml "linenostart=24">}}
      - name: Install dependencies
        run: dotnet restore
{{</highlight>}}

##### Step 5 - Build documentation page
Now that we have everything installed and our project prepared, we can finally build our documentation HTML. To do so, we run `docfx docfx.json` command.  
In this step, I also change working directory to *docs* folder. This might be not needed or the folder might be named differently depending on your project structure - just point to the folder that contains your *docfx.json* file.  
Additionally, I also explicitly tell GitHub to not run next steps if this one fails - we don't want to publish broken documentation website. GitHub should act this way by default, but by specifying this explicitly, we know for sure that it'll work exactly how we want it to.
{{<highlight yaml "linenostart=26">}}
      - name: DocFX Build
        working-directory: docs
        run: docfx docfx.json
        continue-on-error: false
{{</highlight>}}

##### Step 6 - Publish
We're almost there. The last step is to actually publish the documentation website so it can be seen by everyone. To simplify this task, I use action [actions-gh-pages](https://github.com/peaceiris/actions-gh-pages) by *[peaceiris](https://github.com/peaceiris)*.  We tell it to publish contents of `docs/_site` folder (_site is default folder for DocFX - but if you changed it in *docfx.json*, you can change that value).  
I also use `force_orphan` option - this will ensure that `gh-pages` branch has no history, and no redundant files.  
An `if` property plays important role in this step - it ensures that this step is skipped for anything that isn't a push to master branch. This enhances security of our documentation website by preventing anyone overwriting it by opening a Pull Request. This also ensures that documentation is only updated when changes are released to master branch - and won't keep changing for features that are still WIP.
{{<highlight yaml "linenostart=30">}}
      - name: Publish
        if: github.event_name == 'push'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/_site
          force_orphan: true
{{</highlight>}}

{{<admonition tip>}}
If you want to use a custom domain, you can also add `cname` to `with`. Use your domain as the value.

View [GitHub Docs](https://docs.github.com/en/free-pro-team@latest/github/working-with-github-pages/configuring-a-custom-domain-for-your-github-pages-site) for more information on using custom domains on GitHub Pages.
{{</admonition>}}

#### Saving action
Yay, we have all steps prepared. The entire action should look more or less like this:
{{<highlight yaml>}}
name: DocFX Build and Publish

on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]
    
jobs:
  generate-docs:
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Setup .NET Core
        uses: actions/setup-dotnet@v1
        with:
          dotnet-version: 3.1.101
      - name: Setup DocFX
        uses: crazy-max/ghaction-chocolatey@v1
        with:
          args: install docfx
      - name: Install dependencies
        run: dotnet restore
      - name: DocFX Build
        working-directory: docs
        run: docfx docfx.json
        continue-on-error: false
      - name: Publish
        if: github.event_name == 'push'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/_site
          force_orphan: true
{{</highlight>}}

Now go ahead, and press **Start commit**. You can name your commit, and select whether it should be commited directly to master, or started as a pull request.
{{<image src="screenshot-saving-action-1.png">}}

### Checking the action out
Whether you commit directly or create a pull request, if you didn't change events when [selecting when to run](#selecting-when-to-run), the action should automatically start. The only difference will be that Pull Request will not publish the built documentation page, due to the constraint we set in last step.

You can view your actions progress in **Actions** tab in your repository. You can click on the workflow result name to check the progress.
{{<image src="screenshot-running-action-1.png" caption="Example from Wolfringo - with a slightly more complex setup">}}

You can view steps and their output as it goes. If your action skips publishing due to it not being a push to master, *Publish* step will have a skipped symbol:
{{<image src="screenshot-running-action-2.png" caption="Example from Wolfringo - Publish action was skipped">}}

### Viewing the documentation
Once all steps finish successfuly, if Publishing wasn't skipped, you should see your documentation on `your-gh-username.github.io/repository-name`.

{{<admonition type=note title="Custom domain">}}
If you set custom CNAME in Publish step, your website will be seen at that domain. For example, if your CNAME is set to `my.domain.com`, instead of `your-gh-username.github.io/repository-name`, your documentation will be viewable under `my.domain.com`.

View [GitHub Docs](https://docs.github.com/en/free-pro-team@latest/github/working-with-github-pages/configuring-a-custom-domain-for-your-github-pages-site) for more information on using custom domains on GitHub Pages.
{{</admonition>}}

## Summary
You should now know how to automate your DocFX documentation publishing with GitHub Pages. It's a great way to reduce that manual step for all your future development and all documentation changes - you can focus on coding and writing guides instead!

Of course, both GitHub Actions and GitHub Pages can be used for a wide variety of other use cases as well - don't stop exploring!