// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ServiceDefaultsExtensions.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  ServiceDefaults
// =============================================

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace ServiceDefaults;

/// <summary>
///     Wires OpenTelemetry and health checks into a Generated App's host, and maps the health endpoints Development
///     uses to probe it.
/// </summary>
public static class ServiceDefaultsExtensions
{
	private const string HealthEndpointPath = "/health";

	private const string AlivenessEndpointPath = "/alive";

	private const string LiveTag = "live";

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

		ConfigureOpenTelemetry(builder);

		builder.Services.AddHealthChecks()
			.AddCheck("self", () => HealthCheckResult.Healthy(), [LiveTag]);

		return builder;
	}

	/// <summary>
	///     Maps <c>/health</c> and <c>/alive</c> on <paramref name="app" /> when its environment is Development.
	/// </summary>
	/// <param name="app">The application to map the endpoints on.</param>
	/// <returns><paramref name="app" />, for chaining.</returns>
	public static WebApplication MapDefaultEndpoints(this WebApplication app)
	{
		ArgumentNullException.ThrowIfNull(app);

		// Health endpoints in production leak state and invite probing, so a deployed Generated App adds its own
		// protected ones when its host needs them (https://aka.ms/dotnet/aspire/healthchecks).
		if (app.Environment.IsDevelopment())
		{
			// /health requires every check to pass; /alive only the "live" ones, so a slow dependency doesn't get a
			// healthy process restarted.
			app.MapHealthChecks(HealthEndpointPath);
			app.MapHealthChecks(AlivenessEndpointPath, new HealthCheckOptions
			{
				Predicate = registration => registration.Tags.Contains(LiveTag)
			});
		}

		return app;
	}

	private static void ConfigureOpenTelemetry(IHostApplicationBuilder builder)
	{
		builder.Logging.AddOpenTelemetry(logging =>
		{
			logging.IncludeFormattedMessage = true;
			logging.IncludeScopes = true;
		});

		OpenTelemetryBuilder openTelemetry = builder.Services.AddOpenTelemetry()
			.WithMetrics(metrics => metrics
				.AddAspNetCoreInstrumentation()
				.AddHttpClientInstrumentation()
				.AddRuntimeInstrumentation())
			.WithTracing(tracing => tracing
				.AddSource(builder.Environment.ApplicationName)
				.AddAspNetCoreInstrumentation(options =>
					// Probes hit the health endpoints every few seconds; tracing them would bury the real requests.
					options.Filter = context => !IsHealthEndpoint(context.Request.Path))
				.AddHttpClientInstrumentation());

		// The AppHost sets the endpoint to its dashboard; without one there is nowhere to export to.
		if (!string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
		{
			openTelemetry.UseOtlpExporter();
		}
	}

	private static bool IsHealthEndpoint(PathString path)
	{
		return path.StartsWithSegments(HealthEndpointPath, StringComparison.OrdinalIgnoreCase)
			|| path.StartsWithSegments(AlivenessEndpointPath, StringComparison.OrdinalIgnoreCase);
	}
}
