---
title: "TehGM's Docker Cheatsheet"
slug: docker-cheatsheet
subtitle: ""
description: ""

date: 2021-09-17 19:52:21+01:00
lastmod: 2021-09-17 19:52:21+01:00
draft: false
list: true
hiddenFromSearch: false

categories: [ "Technology" ]
tags: [ "guide", "dev" ]
series: [ ]

featuredImage: ""
featuredImagePreview: ""

code:
  maxShownLines: 35
---

Docker is awesome. However, more often than not I keep googling or copying from thing I previously used.

For this reason, I decided to build up a small personal cheatsheet of Docker commands/snippets. It's primarily for my own purposes, but hey, why not share it publicly!

<!--more-->

## Commands
Note: `NAME` in all commands is the Container's name.

Note: all commands are for Linux, some even Debian/Ubuntu specific.

### Installing Docker on Debian/Ubuntu
{{<highlight bash>}}
# uninstall old version
sudo apt-get remove docker docker-engine docker.io containerd runc

# pre-install steps
sudo apt-get update

sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

## Standard:
echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

## armhf (Raspberry Pi):
echo \
  "deb [arch=armhf signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

## arm64:
echo \
  "deb [arch=arm64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# install
sudo apt-get update

sudo apt-get install docker-ce docker-ce-cli containerd.io
{{</highlight>}}

### List Containers
{{<highlight bash>}}
docker container ls
{{</highlight>}}

### Build Image with Dockerfile
{{<highlight bash>}}
docker build -t repo/name:tag .
{{</highlight>}}

### Stop and remove existing Container (CI/CD safe)
{{<highlight bash>}}
docker stop NAME || true
docker rm NAME || true
{{</highlight>}}

### Run Container in background
{{<highlight bash>}}
docker run -d --name=NAME repo/name:tag
{{</highlight>}}

### Run Container with auto-restart (like service)
{{<highlight bash>}}
docker run -d --name=NAME --restart=always repo/name:tag
{{</highlight>}}

### Prune unused Docker Containers
{{<highlight bash>}}
docker image prune -f -a
{{</highlight>}}

### Expose ports
{{<highlight bash>}}
docker run -d --name=NAME -p [host-port]:[container-port]
{{</highlight>}}

### Mount directory
{{<highlight bash>}}
docker run -d --name=NAME -v [host-location]:[container-location]
# example:
docker run -d --name=NAME -v "/var/log/MyApp":"/logs"
{{</highlight>}}

### View running Container's files
{{<highlight bash>}}
docker exec -i -t NAME /bin/bash
cat [file]
{{</highlight>}}

### View Container's logs
{{<highlight bash>}}
docker logs NAME
{{</highlight>}}


## Dockerfile snippets
### ASP.NET Core 5.0
{{<highlight dockerfile>}}
FROM mcr.microsoft.com/dotnet/aspnet:5.0
EXPOSE 80
COPY . .
ENTRYPOINT ["dotnet", "MyApp.dll"]
{{</highlight>}}

### ASP.NET Core 5.0 (for armhf)
{{<highlight dockerfile>}}
FROM mcr.microsoft.com/dotnet/aspnet:5.0.10-bullseye-slim-arm32v7
EXPOSE 80
COPY . .
ENTRYPOINT ["dotnet", "MyApp.dll"]
{{</highlight>}}

### Keep Container without background Entrypoint running
{{<highlight dockerfile>}}
...
ENTRYPOINT ["tail", "-f", "/dev/null"]
{{</highlight>}}

## Other?
This list is not exhaustive by any means, and I'll probably keep updating it.

For now these are my most used commands and snippets.