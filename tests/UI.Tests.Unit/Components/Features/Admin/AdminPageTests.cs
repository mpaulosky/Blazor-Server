// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AdminPageTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using System.Security.Claims;

using AngleSharp.Dom;

using Domain.Constants;

using UI.Components.Features.Admin;

namespace UI.Tests.Unit.Components.Features.Admin;

public class AdminPageTests : BunitContext
{
	[Fact]
	public void Render_Admin_ShowsAdminEyebrowAdminTitleAndLead()
	{
		// Arrange
		AddAuthorization().SetAuthorized("an-admin");

		// Act
		IRenderedComponent<AdminPage> cut = Render<AdminPage>();

		// Assert
		cut.Find("header span").TextContent.Trim().Should().Be("Admin");
		cut.Find("header h1").TextContent.Trim().Should().Be("Admin");
		cut.Find("header p").TextContent.Trim().Should().Be("Only an Admin can see this page.");
	}

	[Fact]
	public void Render_Admin_ShowsProtectionStatTilesReadFromApplicationConstants()
	{
		// Arrange
		AddAuthorization().SetAuthorized("an-admin");

		// Act
		IRenderedComponent<AdminPage> cut = Render<AdminPage>();

		// Assert
		IElement[] labels = [.. cut.FindAll("dt")];
		IElement[] values = [.. cut.FindAll("dd")];
		labels.Select(label => label.TextContent.Trim()).Should().Equal("Policy", "Role", "Source");
		values.Select(value => value.TextContent.Trim()).Should()
			.Equal(ApplicationConstants.AdminPolicy, ApplicationConstants.AdminRole, "Auth0 role claim");
	}

	[Fact]
	public void Render_Admin_WithRoleClaims_ShowsOneAccentBadgePerRoleClaim()
	{
		// Arrange
		AddAuthorization().SetAuthorized("an-admin")
			.SetClaims(new Claim(ClaimTypes.Role, "Admin"), new Claim(ClaimTypes.Role, "Editor"));

		// Act
		IRenderedComponent<AdminPage> cut = Render<AdminPage>();

		// Assert
		IElement[] badges = [.. cut.FindAll("span.border-accent-200")];
		badges.Select(badge => badge.TextContent.Trim()).Should().Equal("Admin", "Editor");
	}
}
