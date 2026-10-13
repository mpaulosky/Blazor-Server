// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AppHost.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  AppHost
// =============================================

using Domain.Constants;

IDistributedApplicationBuilder builder = DistributedApplication.CreateBuilder(args);

// The AppHost shares UI's UserSecretsId, so these read the same Auth0:* user secrets as `dotnet run --project src/UI`.
// When one is missing, the Aspire dashboard asks for it.
IResourceBuilder<ParameterResource> auth0Domain = builder.AddParameterFromConfiguration("auth0-domain", "Auth0:Domain");
IResourceBuilder<ParameterResource> auth0ClientId =
	builder.AddParameterFromConfiguration("auth0-client-id", "Auth0:ClientId");
IResourceBuilder<ParameterResource> auth0ClientSecret =
	builder.AddParameterFromConfiguration("auth0-client-secret", "Auth0:ClientSecret", secret: true);

// The http launch profile lets the AppHost start the UI where there's no developer certificate (CI, the Sandcastle
// sandbox). The health check holds WebApp back from "healthy" until it answers /health, which it maps in Development.
builder.AddProject<Projects.UI>(ApplicationConstants.Website, launchProfileName: "http")
	.WithHttpHealthCheck("/health")
	.WithEnvironment("Auth0__Domain", auth0Domain)
	.WithEnvironment("Auth0__ClientId", auth0ClientId)
	.WithEnvironment("Auth0__ClientSecret", auth0ClientSecret);

builder.Build().Run();
