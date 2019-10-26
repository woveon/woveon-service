# woveon-service

[![Total alerts](https://img.shields.io/lgtm/alerts/g/woveon/woveon-service.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/woveon/woveon-service/alerts/)

![Woveon Logo](https://raw.githubusercontent.com/wiki/woveon/woveon-service/imgs/woveonlogo.png)


WoveonService is a microservice development platform, designed for REST/GraphQL endpoints, with strict opinions on layering interface, app and state functionality. It is designed to simplify error-prone complexities in development by being opinionated about naming and organization of code (possible only because microservices are small). Additionally, it's model-based organization and approach to data decomposition enables loose coupling of data, robustness in incomplete knowledge of models, and a novel approach to data decomposition that can aid microservice decomposition.

**Opinions**: Microservices should be simple, so you can focus on three things:
- handling incoming requests, data and schemas and errors handling
- performing application computations
- a clear, organized and small API

## See the [Wiki](https://github.com/woveon/woveon-service/wiki) for documentation.

![Microservice Overview](https://raw.githubusercontent.com/wiki/woveon/woveon-service/imgs/wovservice_0002.png)

## Origins

We first built on ExpressJS, with clear and understandable code until the API grew. We wanted more syntactic sugar and standardized coding practices among other features, which we built into WoveonService. WovService is designed for WovTools projects but is not needed.


## About Woveon

Woveon is an enterprise conversation management software. Using AI and machine learning, it helps businesses take control of their conversations - to provide exceptional customer experience, audit for compliance, and maximize revenue.

