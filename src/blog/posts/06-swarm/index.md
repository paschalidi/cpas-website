---
title: learning docker - day 6
author: Christos Paschalidis
date: 2021-01-03
hero: /blog/images/06-swarm/docker.png
excerpt: Swarm lifecycle
---

# swarm full app lifecycle

![image](/blog/images/06-swarm/update-service.png)

### lab

1. create new service

```
docker service create -p 8088:80 --name web nginx:1.13   
```

2. scale it up to 5

```
docker service scale web=5           
```

3. update the service by changing the image to a newer version

```
docker service update --image nginx:1.14 web
```

4. change published port from 8088 to 9090

tip. you first add a new one and remove the old one at the same time. like so,

```
docker service update --publish-rm published=8088,target=80 --publish-add published=9090,target=80 web   
```

5. tip update by force

```
docker service update --force web 
```

6. always remove the services by

```
docker service rm <serviceId>
```


### docker healthchecks 

![image](/blog/images/06-swarm/healthcheck.png)
