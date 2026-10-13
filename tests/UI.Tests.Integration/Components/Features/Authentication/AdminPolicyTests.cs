// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AdminPolicyTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Security.Claims;

using Domain.Constants;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

public class AdminPolicyTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public AdminPolicyTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[Theory]
	[InlineData("Admin", true)]
	[InlineData("[\"User\",\"Admin\"]", true)]
	[InlineData("User", false)]
	[InlineData(null, false)]
	public async Task AuthorizeAsync_AdminPolicy_MatchesConfiguredRoleClaim(string? roleClaimValue,
		bool expectedSuccess)
	{
		// Arrange
		await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();

		// Act
		AuthorizationResult result = await AuthorizeAgainstAdminPolicyAsync(scope.ServiceProvider,
			Auth0Options.DefaultRoleClaimType, roleClaimValue);

		// Assert
		result.Succeeded.Should().Be(expectedSuccess);
	}

	[Fact]
	public async Task AuthorizeAsync_CustomRoleClaimType_MatchesAdminPolicy()
	{
		// Arrange
		const string customRoleClaimType = "https://custom/roles";
		await using WebApplicationFactory<Program> customFactory = _factory.WithWebHostBuilder(builder =>
			builder.UseSetting("Auth0:RoleClaimType", customRoleClaimType));
		await using AsyncServiceScope scope = customFactory.Services.CreateAsyncScope();

		// Act
		AuthorizationResult result =
			await AuthorizeAgainstAdminPolicyAsync(scope.ServiceProvider, customRoleClaimType, "Admin");

		// Assert
		result.Succeeded.Should().BeTrue();
	}

	private static async Task<AuthorizationResult> AuthorizeAgainstAdminPolicyAsync(IServiceProvider services,
		string roleClaimType, string? roleClaimValue)
	{
		List<Claim> claims = [new Claim(ClaimTypes.NameIdentifier, "a-user")];

		if (roleClaimValue is not null)
		{
			claims.Add(new Claim(roleClaimType, roleClaimValue));
		}

		ClaimsPrincipal principal = new(new ClaimsIdentity(claims, "Test"));
		IClaimsTransformation transformation = services.GetRequiredService<IClaimsTransformation>();
		ClaimsPrincipal transformed = await transformation.TransformAsync(principal);
		IAuthorizationService authorizationService = services.GetRequiredService<IAuthorizationService>();

		return await authorizationService.AuthorizeAsync(transformed, null, ApplicationConstants.AdminPolicy);
	}
}
