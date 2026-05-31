---
title: learning docker - day 3
author: Christos Paschalidis
date: 2020-12-16
hero: /blog/images/03-docker-commands-volums/docker.png
excerpt: Docker commands I learned today
---

# docker compose

### template
`docker-compose.yml`

```
version: '3.1'  # if no version is specified then v1 is assumed. Recommend v2 minimum

services:  # containers. same as docker run
  servicename: # a friendly name. this is also DNS name inside network
    image: # Optional if you use build:
    command: # Optional, replace the default CMD specified by the image
    environment: # Optional, same as -e in docker run
    volumes: # Optional, same as -v in docker run
  servicename2:

volumes: # Optional, same as docker volume create

networks: # Optional, same as docker network create

```

# custom build images
see example [here](https://github.com/paschalidi/custom-docker-compose-nginx)

### to build this you need to use

```
docker compose build
```

### to remove it

```
docker compose down -rmi local
```

will also remove all the custom image build

# swarm

swarm comes inactivated by default.

to activate
```
docker swarm init
```

### list the managers and the workers
```
docker node ls
```

# swarm
```
docker swarm --help
```

### service
replaces the docker run for swarms

```
docker service --help
```

### run a service and ping an ip
```
docker service create --name apl alpine ping 8.8.8.8
```

### list all the service

```
docker service ls
```
### will show you all the tasks or else containers for this service
```
docker service ps <name>
```

### create replicas

```
docker service update apl --replicas 3
```

### swarm cluster - 3 nodes

using https://get.docker.com/ to install docker to a digital ocean droplet
1. create the droplet
2. install docker
3. init swarm in the public ip
```
docker swarm init --advertise-addr 165.22.94.133
```

#install docker in a vm using userdata

```
#!/bin/bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker root # root needs to be the user. now in ec2 I thinkg the user is ec2-user or root
```

this is what you see when you do the bellow. [see image](https://prnt.sc/w4jone)
the `*` explains where you are.
```
docker node ls
```

### take the manager token

you wanna do that _for each node_.
you get the keys. they are always available and you can also change them in case of explosure
```
docker node update --role manager <node_name>
docker swarm join-token manager
```

this will give you something between these lines
```
docker swarm join --token SWMTKN-1-asdasda-94joeig0exhdk7319jgnwj662 xxx.xx.xx.xxx:2377
```

now you will now have to copy and paste this to the node