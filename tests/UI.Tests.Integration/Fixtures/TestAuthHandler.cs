// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     TestAuthHandler.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Security.Claims;
using System.Text.Encodings.Web;

using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;

using UI.Components.Features.Authentication;

namespace UI.Tests.Integration.Fixtures;

/// <summary>
///   Authenticates test requests from the <see cref="UserHeaderName" /> and <see cref="RoleClaimHeaderName" />
///   headers, standing in for an Auth0 cookie session so integration tests can drive every caller shape without a
///   real tenant. Never adds <see cref="ClaimTypes.Role" /> itself: that mapping is the app's own
///   <see cref="RoleClaimsTransformation" />'s job.
/// </summary>
internal sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
	/// <summary>
	///   The scheme name this handler registers under.
	/// </summary>
	public const string SchemeName = "Test";

	/// <summary>
	///   The header that names the signed-in test user. Its absence means the caller is a Visitor.
	/// </summary>
	public const string UserHeaderName = "X-Test-User";

	/// <summary>
	///   A repeatable header whose each value becomes one role claim of the app's configured role claim type,
	///   verbatim (a single role, or a JSON array of roles as one value).
	/// </summary>
	public const string RoleClaimHeaderName = "X-Test-Role-Claim";

	/// <summary>
	///   Initializes a new instance of <see cref="TestAuthHandler" />.
	/// </summary>
	public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
		UrlEncoder encoder) : base(options, logger, encoder)
	{
	}

	/// <inheritdoc />
	protected override Task<AuthenticateResult> HandleAuthenticateAsync()
	{
		if (!Request.Headers.TryGetValue(UserHeaderName, out StringValues userName) || string.IsNullOrEmpty(userName))
		{
			return Task.FromResult(AuthenticateResult.NoResult());
		}

		List<Claim> claims =
		[
			new Claim(ClaimTypes.NameIdentifier, userName.ToString()),
			new Claim(ClaimTypes.Name, userName.ToString()),
		];

		foreach (string? roleClaimValue in Request.Headers[RoleClaimHeaderName])
		{
			if (!string.IsNullOrEmpty(roleClaimValue))
			{
				claims.Add(new Claim(Auth0Options.DefaultRoleClaimType, roleClaimValue));
			}
		}

		ClaimsIdentity identity = new(claims, SchemeName);
		ClaimsPrincipal principal = new(identity);
		AuthenticationTicket ticket = new(principal, SchemeName);

		return Task.FromResult(AuthenticateResult.Success(ticket));
	}
}
