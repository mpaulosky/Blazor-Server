// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ServiceDefaultsExtensions.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  ServiceDefaults
// =============================================

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;

namespace ServiceDefaults;

/// <summary>
///     Wires OpenTelemetry and health checks into a Generated App's host, and maps the health endpoints Development
///     uses to probe it.
/// </summary>
public static class ServiceDefaultsExtensions
{
	/// <summary>
	///     Adds OpenTelemetry logging, metrics and tracing, and a <c>self</c> health check tagged <c>live</c>, to
	///     <paramref name="builder" />.
	/// </summary>
	/// <typeparam name="TBuilder">The host builder type.</typeparam>
	/// <param name="builder">The host builder to configure.</param>
	/// <returns><paramref name="builder" />, for chaining.</returns>
	public static TBuilder AddServiceDefaults<TBuilder>(this TBuilder builder)
		where TBuilder : IHostApplicationBuilder
	{
		ArgumentNullException.ThrowIfNull(builder);

		throw new NotImplementedException();
	}

	/// <summary>
	///     Maps <c>/health</c> and <c>/alive</c> on <paramref name="app" /> when its environment is Development.
	/// </summary>
	/// <param name="app">The application to map the endpoints on.</param>
	/// <returns><paramref name="app" />, for chaining.</returns>
	public static WebApplication MapDefaultEndpoints(this WebApplication app)
	{
		ArgumentNullException.ThrowIfNull(app);

		throw new NotImplementedException();
	}
}
