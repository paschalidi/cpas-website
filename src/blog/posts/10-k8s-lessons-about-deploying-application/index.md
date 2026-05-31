---
title: Kubectl course and notes
author: Christos Paschalidis
date: 2021-10-26
hero: /blog/images/10-k8s-lessons-about-deploying-application/image.png
excerpt: A note different kubectl commands
---


# useful commands

to authenticate in gcp  
```
gcloud container clusters get-credentials cluster-1 --zone=us-central1-c
```
____


you can create an object declaratively for example when you have a yaml that looks like this 
```yaml
apiVersion: v1
kind: Pod
metadata: 
  name: nginx
spec:
  containers:
    - name: nginx
      image: nginx
      ports:
      - name: web
        containerPort: 80
```

you can do when the name of the file is nginx.yaml
```
kubectl apply -f nginx.yaml 
```
___
creates a tunel for the port exposed from our pod to our shell so we can access it locally
```
kubectl port-forward
```

eg nginx exposes port 80 and we map it to our local shell on 8080 so we can preview it. 
```
kubectl port-forward nginx 8080:80
```

____

you can delete object we created declaratively

```
kubectl delete -f nginx.yaml
```

____
a yaml example of running multiple containers in the same pod

```yaml
apiVersion: v1
kind: Pod
metadata: 
  name: multi
spec:
  volumes:
    - name: shared-data
      emptyDir: {}
  containers:
    - name: web-container
      image: nginx
      volumeMounts:
        - mountPath: /usr/share/nginx/html
          name: shared-data
      ports:
      - name: web
        containerPort: 80
    - name: ftp-container
      image: fauria/vsftpd
      volumeMounts:
        - mountPath: /pod-data
          name: shared-data
```


here you can connect to the container using the command 
```
kubectl exec -it multi -c ftp-container -- /bin/bash
```

____

see details of a deployment 

```bash
kubectl describe deploymemt {nameofdeployment}
```

____

update an existing deployment 


```bash
kubectl apply -f {nameOfTheDeployent.yaml} --record 
```

____ 
to see the status of our deployment. Note: nameOfDeployment is not the yaml file. Each deployment has a specific name 

```bash
kubectl rollout status {nameOfDeployment} 
```
____
to undo a deployment. Note: nameOfDeployment is not the yaml file. Each deployment has a specific name

```bash
kubectl rollout undo {{nameOfDeployment} }
```


# logging & debugging