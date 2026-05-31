---
title: learning docker - day 4
author: Christos Paschalidis
date: 2020-12-17
hero: /blog/images/04-docker-compose/docker.png
excerpt: Docker commands I learned today
---

# container lifetime & persistent data

when there is the need to store data like databases etc we use something called Volumes.
Now you can create volumes while you writing your Dockerfile and that basically means that you will
allocate some space outside of the container and this will be persistent even when
you delete the container itself. Volumes need manual removal and they can only be destroyed by
an extra step.

*** TIP: Volumes can be defined in the Dockerfile

### inspect image metadata.
will give you the metadata of the image.
```
docker image inspect mysql
```

### list the volumes

```
docker volume ls
```

### created images with named volumes
you can do so by passing the `-v` argument in the container creation
```
docker container run -d --name mysql-named -e MYSQL_ALLOW_EMPTY_PASSWORD=True -v mysql-db:/var/lib/mysql  mysql
```

### inspect named volumes
```
docker volume inspect mysql-named
```

### create a volume ahead of time

```
docker volume create --help
```

# bind mounting

is just a mapping of the files in the host file/directory into the file/directory of the container

Cant be defined in the docker file you can only do that when you do `docker run . . .`


### view logs of container
```
docker container logs -f <containerName>
```


