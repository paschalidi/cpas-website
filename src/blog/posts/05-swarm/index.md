---
title: learning docker - day 5
author: Christos Paschalidis
date: 2021-01-02
hero: /blog/images/05-swarm/docker.png
excerpt: Swarm
---

# swarm


### install docker with user data
```
#!/bin/bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker <username eg root>
```

### swarm lab - part 01 setup the swarm  
1. setup three droplets with docker installed as above.

2. on node-01 initiate swarm on a public ip address
```
docker swarm init --advertise--addr <IP_ADDRESS>
```

3. add the node-02 as worker.

ssh on node-02 and ask it to join the swarm
```
docker swarm join --token <token> <IP>
```
PS this command is printed for you after you do swarm init

4. update the role of node-02 to be a manager

on node-01 execute
```
docker node update --role manager node-02
```

now if you do `docker node ls` you will see node-02 being reachable.

5. take the join token to add also the third node

```
docker swarm join-token manager
```

6. paste on node-03 the join command

```
docker swarm join --token <token> <IP_ADDRESS>

```
![image](/blog/images/05-swarm/manager-status.png)
The manager status indicates that these nodes are managers.

### swarm lab - part 02 install two services. a website and a database

1. create a network overlay 

```
docker network create --driver overlay mydrupal
```  

2. create the database service and add it to the network we created 
```
docker service create --name psql --network mydrupal -e POSTGRES_PASSWORD=mypass postgres
```

![image](/blog/images/05-swarm/docker-service-ps.png)
runs on node-01

3. create the drupal service and add it to the same network
```
docker service create --name drupal --network mydrupal -p 80:80 drupal
```
![image](/blog/images/05-swarm/docker-service-ps2.png)=

4. visit a droplet and see the service running 

![image](/blog/images/05-swarm/docker-droplet-ip.png)

5. drupal setup
must be the same as the service name so that they can communicate.
![image](/blog/images/05-swarm/docker-drupal-setup.png)

6. drupal complete
![image](/blog/images/05-swarm/docker-drupal-setup-complete.png)

### swarm lab - part 03 routing mesh 

1. creating one more service. elasticsearch
```
 docker service create --name search --replicas 3 -p 9200:9200 elasticsearch:2
```

2. on node-01 use curl to see the loadbalancer working 

```
curl localhost:9200
```

# swarm stacks 

we will be using 

```
docker stack deploy
```

example 
```
version: "3"
services:

  redis:
    image: redis:alpine
    ports:
      - "6379"
    networks:
      - frontend
    deploy:
      replicas: 1
      update_config:
        parallelism: 2
        delay: 10s
      restart_policy:
        condition: on-failure
  db:
    image: postgres:9.4
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - backend
    environment:
      - POSTGRES_HOST_AUTH_METHOD=trust
    deploy:
      placement:
        constraints: [node.role == manager]
  vote:
    image: bretfisher/examplevotingapp_vote
    ports:
      - 5000:80
    networks:
      - frontend
    depends_on:
      - redis
    deploy:
      replicas: 5
      update_config:
        parallelism: 2
      restart_policy:
        condition: on-failure
  result:
    image: bretfisher/examplevotingapp_result
    ports:
      - 5001:80
    networks:
      - backend
    depends_on:
      - db
    deploy:
      replicas: 1
      update_config:
        parallelism: 2
        delay: 10s
      restart_policy:
        condition: on-failure

  worker:
    image: bretfisher/examplevotingapp_worker:java
    networks:
      - frontend
      - backend
    depends_on:
      - db
      - redis
    deploy:
      mode: replicated
      replicas: 1
      labels: [APP=VOTING]
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 3
        window: 120s
      placement:
        constraints: [node.role == manager]

  visualizer:
    image: dockersamples/visualizer
    ports:
      - "8080:8080"
    stop_grace_period: 1m30s
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
    deploy:
      placement:
        constraints: [node.role == manager]

networks:
  frontend:
  backend:

volumes:
  db-data:
```