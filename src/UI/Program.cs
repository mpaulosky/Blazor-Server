// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     Program.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using Microsoft.AspNetCore.Diagnostics;

using ServiceDefaults;

using UI.Components;
using UI.Components.Features.Authentication;
using UI.Components.Features.Themes;
using UI.Components.Layout;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddRazorComponents()
	.AddInteractiveServerComponents();

// The Footer's year comes from TimeProvider, so tests can fix the clock. AddAuthentication also registers it, but
// only as a side effect, so the app registers it in its own right.
builder.Services.AddSingleton(TimeProvider.System);

// Stamped at compile time by UI.csproj's GenerateBuildInfo target; a singleton, so tests can register their own.
builder.Services.AddSingleton(new BuildInfo(BuildInfoConstants.Release, BuildInfoConstants.Commit,
	BuildInfoConstants.RepositoryUrl));

builder.Services.AddAuthenticationFeature(builder.Configuration);
builder.Services.AddThemeFeature();
builder.Services.AddCascadingAuthenticationState();

WebApplication app = builder.Build();

if (!app.Environment.IsDevelopment())
{
	app.UseExceptionHandler("/Error", createScopeForErrors: true);
	// The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
	app.UseHsts();
}

app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);

// Re-execution keeps the request's method, and a POST to the NotFound page fails that page's antiforgery check, which
// would replace the original status with a 400 and a message meant for developers. Only GET and HEAD get the page.
app.Use((context, next) =>
{
	if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
	{
		context.Features.Get<IStatusCodePagesFeature>()?.Enabled = false;
	}

	return next(context);
});

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

// After authentication: antiforgery tokens are bound to the signed-in user.
app.UseAntiforgery();

app.MapDefaultEndpoints();
app.MapStaticAssets();
app.MapAuthenticationEndpoints();
app.MapThemeEndpoints();
app.MapRazorComponents<App>()
	.AddInteractiveServerRenderMode();

app.Run();
