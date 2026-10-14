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

// With no launch profile named, Aspire starts the UI with its launch profile of the same name as the AppHost's: https
// for local development, http where there's no developer certificate (CI, the Sandcastle sandbox), which the tests pick
// with DOTNET_LAUNCH_PROFILE. The health check holds WebApp back from "healthy" until it answers /health, which it
// maps in Development.
IResourceBuilder<ProjectResource> webApp = builder.AddProject<Projects.UI>(ApplicationConstants.Website)
	.WithHttpHealthCheck("/health")
	.WithEnvironment("Auth0__Domain", auth0Domain)
	.WithEnvironment("Auth0__ClientId", auth0ClientId)
	.WithEnvironment("Auth0__ClientSecret", auth0ClientSecret);

// The role claim type is optional and WebApp has its own default, so it's passed on only when it's set.
string? auth0RoleClaimType = builder.Configuration["Auth0:RoleClaimType"];
if (!string.IsNullOrEmpty(auth0RoleClaimType))
{
	webApp.WithEnvironment("Auth0__RoleClaimType", auth0RoleClaimType);
}

builder.Build().Run();
