// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     RoleClaimsTransformationTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using System.Security.Claims;

using Domain.Constants;

using Microsoft.Extensions.Options;

using UI.Components.Features.Authentication;

namespace UI.Tests.Unit.Components.Features.Authentication;

public class RoleClaimsTransformationTests
{
	private readonly RoleClaimsTransformation _sut = new(Options.Create(new Auth0Options()));

	[Theory]
	[InlineData("Admin")]
	[InlineData("[\"User\",\"Admin\"]")]
	public async Task TransformAsync_RoleClaimHoldsAdmin_AddsAdminRole(string roleClaimValue)
	{
		// Arrange
		ClaimsPrincipal principal =
			CreateAuthenticatedPrincipal(new Claim(Auth0Options.DefaultRoleClaimType, roleClaimValue));

		// Act
		ClaimsPrincipal result = await _sut.TransformAsync(principal);

		// Assert
		result.IsInRole(ApplicationConstants.AdminRole).Should().BeTrue();
	}

	[Fact]
	public async Task TransformAsync_TwoSeparateRoleClaims_AddsAdminRole()
	{
		// Arrange
		ClaimsPrincipal principal = CreateAuthenticatedPrincipal(
			new Claim(Auth0Options.DefaultRoleClaimType, "User"),
			new Claim(Auth0Options.DefaultRoleClaimType, "Admin"));

		// Act
		ClaimsPrincipal result = await _sut.TransformAsync(principal);

		// Assert
		result.IsInRole(ApplicationConstants.AdminRole).Should().BeTrue();
	}

	[Fact]
	public async Task TransformAsync_BracketedValueThatIsNotJson_TakesTheValueAsTheRole()
	{
		// Arrange
		const string roleClaimValue = "[Admin";
		ClaimsPrincipal principal =
			CreateAuthenticatedPrincipal(new Claim(Auth0Options.DefaultRoleClaimType, roleClaimValue));

		// Act
		ClaimsPrincipal result = await _sut.TransformAsync(principal);

		// Assert
		result.FindAll(ClaimTypes.Role).Should().ContainSingle().Which.Value.Should().Be(roleClaimValue);
	}

	[Fact]
	public async Task TransformAsync_NoRoleClaim_GrantsNoAdminRole()
	{
		// Arrange
		ClaimsPrincipal principal = CreateAuthenticatedPrincipal();

		// Act
		ClaimsPrincipal result = await _sut.TransformAsync(principal);

		// Assert
		result.IsInRole(ApplicationConstants.AdminRole).Should().BeFalse();
	}

	[Fact]
	public async Task TransformAsync_OnlyUserRoleClaim_GrantsNoAdminRole()
	{
		// Arrange
		ClaimsPrincipal principal =
			CreateAuthenticatedPrincipal(new Claim(Auth0Options.DefaultRoleClaimType, "User"));

		// Act
		ClaimsPrincipal result = await _sut.TransformAsync(principal);

		// Assert
		result.IsInRole(ApplicationConstants.AdminRole).Should().BeFalse();
	}

	[Fact]
	public async Task TransformAsync_CalledTwice_DoesNotDuplicateRoles()
	{
		// Arrange
		ClaimsPrincipal principal =
			CreateAuthenticatedPrincipal(new Claim(Auth0Options.DefaultRoleClaimType, "Admin"));

		// Act
		ClaimsPrincipal onceTransformed = await _sut.TransformAsync(principal);
		ClaimsPrincipal twiceTransformed = await _sut.TransformAsync(onceTransformed);

		// Assert
		twiceTransformed.FindAll(ClaimTypes.Role).Should().ContainSingle();
	}

	[Fact]
	public async Task TransformAsync_CustomRoleClaimType_IsHonouredAndDefaultTypeClaimsAreIgnored()
	{
		// Arrange
		const string customRoleClaimType = "https://custom/roles";
		RoleClaimsTransformation sut =
			new(Options.Create(new Auth0Options { RoleClaimType = customRoleClaimType }));
		ClaimsPrincipal principal = CreateAuthenticatedPrincipal(
			new Claim(Auth0Options.DefaultRoleClaimType, "User"),
			new Claim(customRoleClaimType, "Admin"));

		// Act
		ClaimsPrincipal result = await sut.TransformAsync(principal);

		// Assert
		result.FindAll(ClaimTypes.Role).Should().ContainSingle().Which.Value.Should().Be("Admin");
	}

	[Fact]
	public async Task TransformAsync_UnauthenticatedPrincipal_GainsNoRoles()
	{
		// Arrange
		ClaimsPrincipal principal = new(new ClaimsIdentity());

		// Act
		ClaimsPrincipal result = await _sut.TransformAsync(principal);

		// Assert
		result.FindAll(ClaimTypes.Role).Should().BeEmpty();
	}

	private static ClaimsPrincipal CreateAuthenticatedPrincipal(params Claim[] claims) =>
		new(new ClaimsIdentity(claims, "Test"));
}
