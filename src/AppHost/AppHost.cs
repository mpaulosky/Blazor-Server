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

// The http launch profile lets the AppHost start the UI where there's no developer certificate (CI, the Sandcastle
// sandbox). The health check holds WebApp back from "healthy" until it answers /health, which it maps in Development.
builder.AddProject<Projects.UI>(ApplicationConstants.Website, launchProfileName: "http")
	.WithHttpHealthCheck("/health");

builder.Build().Run();
