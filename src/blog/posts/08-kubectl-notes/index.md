---
title: K8s lab – deploying a real world app
author: Christos Paschalidis
date: 2021-11-5
hero: /blog/images/08-kubectl-notes/image.png
excerpt: A note different kubectl commands
---


# Lab 

Goal is to deploy a multi tier application. 

0. We create a cluster with three nodes manually from the ui and we authorise it
```
   gcloud container clusters get-credentials {cluster-name} --zone=us-central1-c
```

1. Using the console of gcp we want to create a file where we are going to hold the yml files. These are the manifest files we need to later deploy our application

```
mkdir redisdemo
```

2. in the redis demo we create two files
   1. `redis-master-deployment.yaml`. This file contains [these information](https://github.com/ACloudGuru-Resources/Course_GKE_Beginner_To_Pro/blob/master/Chapter_Three/Lecture_1_Lab/redisdemo/redis-master-deployment.yaml) 
   2. `redis-master-service.yaml`. This file contains [these information](https://github.com/ACloudGuru-Resources/Course_GKE_Beginner_To_Pro/blob/master/Chapter_Three/Lecture_1_Lab/redisdemo/redis-master-service.yaml)

3. we create the redi slave deployment yaml and its service
   1. `redis-slave-deployment.yaml`. This file contains [these information](https://github.com/ACloudGuru-Resources/Course_GKE_Beginner_To_Pro/blob/master/Chapter_Three/Lecture_1_Lab/redisdemo/redis-slave-deployment.yaml) 
   2. `redis-slave-service.yaml`. This file contains [these information](https://github.com/ACloudGuru-Resources/Course_GKE_Beginner_To_Pro/blob/master/Chapter_Three/Lecture_1_Lab/redisdemo/redis-slave-service.yaml)
   

4. we then want to use `kubectl` to deploy all of those. 
```
kubectl apply -f redis-master-deployment.yaml
kubectl apply -f redis-master-service.yaml
kubectl apply -f redis-slave-deployment.yaml
kubectl apply -f redis-slave-service.yaml
```

5. we can use the `kubectl get services`. There we will find the external ip that our application has been deployed to.




**NOTE**: To refresh k8s knowledge go here quickly https://www.youtube.com/watch?v=cK1iSwfF4dM