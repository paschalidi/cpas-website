---
title: learning docker - day 2
author: Christos Paschalidis
date: 2020-12-15
hero: /blog/images/01-docker-commands/docker.png
excerpt: Docker commands I learned today
---

# commands for image tagging and pushing

### login to docker hub

will authenticate you against docker hub
```
docker login
```

### shows all the metadata of an image
```
docker image inspect
```

# Image tagging and pushing

### create a tag for an image

```
# pseudo
docker image tag <source:tag> <targetImage:tag>

# actual
docker image tag nginx yourDockerHubUsername:nginx
```

### push image to docker hub

```
docker image push <youTaggedImageName>
```

# Dockerfile basics

remember each command (or else line)  is its own layer
```
# required to be there
FROM debian:jessie

# injecting variables for this dockerfile
ENV NGINX_VERSION 1.11.10

# executing shell commands
RUN apt-get update && apt-get install -y --force-yes apache2

# by default nothing is exported.
# APPARENTLY WEB SERVERS USUALLY EXPORT 80 and 443 ports.
# Port 443 is the standard port for all secured HTTP traffic,
# meaning it’s absolutely essential for most modern web activity.
# Encryption is necessary to protect information, as it makes its way between
# your computer and a web server.
# Port 80 is the host port

# now you will still need to use -p or -P to open/forward these ports on the host.
# here we just exposing them
EXPOSE 80 443

# Required the final command that will be executed each time you start or rerun an container
# note that sometimes this command smight be missing on a Dockerfile.
# You might wonder how this is possible when its required.
# This is because the exists in the FROM image you will be using

CMD ["nginx", "-g", "deamon:off"]
```

### other useful commands for Dockerifiles

```
WORKDIR /usr/share... # this is like `cd`
```

```
COPY <localFileName> <dcokerBoxFileName>
```
