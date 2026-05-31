---
title: learning docker - day 1
author: Christos Paschalidis
date: 2020-12-14
hero: /blog/images/00-docker-commands/docker.png
excerpt: Docker commands I learned today
---

# Commands to access and execute commands inside containers

### connect to ubuntu as host in the box (not in the os). As an interactive shell
spins a new container
also this will _stop_ the container running when you exit
```
 docker container run -it --name ubuntu ubuntu
```

### connect back into a docker box and user bash
spins a new container
also this will _stop_ the container running when you exit

```
 docker container start -ai ubuntu
```

### execute a command and delete container after execution
spins a new container
also this will _stop_  and _delete_ the container running when you exit

```
 # pseudo command
 docker container run --rm alpine <command> <term>
 # working example
 docker container run --rm alpine nslookup search
```

### see the shell inside a running container
_you need to have an image called `mysql` for this_
also this will keep the container running when you exit
also works only when you have an existin container running
```
docker container exec -it mysql bash
```

### get into an alpine image (because there is not bash in alpine)

```
docker container -it alpine sh
```
# Docker network generals and its commands

expose a port to your host from the running image
```
docker container run -p
```

see all the ports on this container
```
docker container port <container>
```

### see the traffic in ngix
```
docker container run -p 80:80 --name nginx -d nginx
docker container port nginx
docker container inspect --format '{{ .NetworkSettings.IPAddress }}' nginx
```

### my ip address
```
ifconfig en0
```


# Docker network useful commands

### list networks
```
docker network ls
```

### inspect

```
docker network inspect
```

### create
```
docker network create --driver
```

### attach a network to a container
```
docker network connect
```

### detach a network to a container
```
docker network disconnect
```

### create image with nw

```
docker network create myAppNet
docker container run --name newNginx -d --network myAppNet nginx
docker network inspect myAppNet
```

### connect a container to an existing network

will add the container ID to another network. in the end the container will belong to two nets
```
docker network connect <netIP> <containerID>
```



