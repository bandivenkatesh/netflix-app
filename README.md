# Netflix Platform Application

## Overview

This repository contains the application source code for the Netflix Platform.

The project consists of two services.

- React Frontend
- Spring Boot Backend

The application is containerized using Docker and deployed to Google Kubernetes Engine using Jenkins and Kubernetes.

---

## Architecture

React

↓

Spring Boot

↓

REST API

↓

JSON (v1)

↓

PostgreSQL (v2)

---

## Technology Stack

Frontend

- React
- Vite
- Nginx

Backend

- Java 21
- Spring Boot
- Maven

DevOps

- Docker
- Jenkins
- SonarQube
- Artifact Registry
- Kubernetes
- Gateway API