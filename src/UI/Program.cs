// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     Program.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using ServiceDefaults;

using UI.Components;
using UI.Components.Features.Authentication;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddRazorComponents()
	.AddInteractiveServerComponents();

// The Footer's year comes from TimeProvider, so tests can fix the clock. AddAuthentication also registers it, but
// only as a side effect, so the app registers it in its own right.
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddAuthenticationFeature(builder.Configuration);
builder.Services.AddCascadingAuthenticationState();

WebApplication app = builder.Build();

if (!app.Environment.IsDevelopment())
{
	app.UseExceptionHandler("/Error", createScopeForErrors: true);
	// The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
	app.UseHsts();
}

app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

// After authentication: antiforgery tokens are bound to the signed-in user.
app.UseAntiforgery();

app.MapDefaultEndpoints();
app.MapStaticAssets();
app.MapAuthenticationEndpoints();
app.MapRazorComponents<App>()
	.AddInteractiveServerRenderMode();

app.Run();
