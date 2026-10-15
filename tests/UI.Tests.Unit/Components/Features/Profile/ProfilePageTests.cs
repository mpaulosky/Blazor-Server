// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ProfilePageTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using System.Security.Claims;

using AngleSharp.Dom;

using Bunit.TestDoubles;

using UI.Components.Features.Profile;

namespace UI.Tests.Unit.Components.Features.Profile;

public class ProfilePageTests : BunitContext
{
	[Fact]
	public void Render_User_ShowsUserEyebrowProfileTitleAndSpecLead()
	{
		// Arrange
		AddAuthorization().SetAuthorized("a-user");

		// Act
		IRenderedComponent<ProfilePage> cut = Render<ProfilePage>();

		// Assert
		cut.Find("header span").TextContent.Trim().Should().Be("User");
		cut.Find("header h1").TextContent.Trim().Should().Be("Profile");
		cut.Find("header p").TextContent.Trim().Should().Be("The claims Auth0 sent for your sign-in.");
	}

	[Fact]
	public void Render_User_TableHeaderHasAccentBackgroundAndText()
	{
		// Arrange
		AddAuthorization().SetAuthorized("a-user");

		// Act
		IRenderedComponent<ProfilePage> cut = Render<ProfilePage>();

		// Assert
		cut.Find("thead").ClassList.Should().Contain([
			"bg-accent-200",
			"text-accent-800",
			"dark:bg-accent-800",
			"dark:text-accent-200",
		]);
	}

	[Fact]
	public void Render_User_ShowsOneTableRowPerClaim()
	{
		// Arrange
		BunitAuthorizationContext authorization = AddAuthorization().SetAuthorized("a-user");
		Claim[] suppliedClaims = [new(ClaimTypes.Email, "a-user@example.com"), new(ClaimTypes.Role, "Admin")];
		authorization.SetClaims(suppliedClaims);
		Claim[] expectedClaims = [new(ClaimTypes.Name, "a-user"), .. suppliedClaims];

		// Act
		IRenderedComponent<ProfilePage> cut = Render<ProfilePage>();

		// Assert
		IElement[] rows = [.. cut.FindAll("tbody tr")];
		rows.Should().HaveCount(expectedClaims.Length);
		for (int i = 0; i < expectedClaims.Length; i++)
		{
			IElement[] cells = [.. rows[i].QuerySelectorAll("td")];
			cells[0].TextContent.Should().Be(expectedClaims[i].Type);
			cells[1].TextContent.Should().Be(expectedClaims[i].Value);
		}
	}

	[Fact]
	public void Render_User_ClaimTypeCellHasFontMonoTextXsBreakAllClasses()
	{
		// Arrange
		AddAuthorization().SetAuthorized("a-user").SetClaims(new Claim(ClaimTypes.Email, "a-user@example.com"));

		// Act
		IRenderedComponent<ProfilePage> cut = Render<ProfilePage>();

		// Assert
		IElement typeCell = cut.Find("tbody tr td:first-child");
		typeCell.ClassList.Should().Contain(["font-mono", "text-xs", "break-all"]);
	}

	[Fact]
	public void Render_User_ClaimValueCellHasWrapAnywhereClass()
	{
		// Arrange
		AddAuthorization().SetAuthorized("a-user").SetClaims(new Claim(ClaimTypes.Email, "a-user@example.com"));

		// Act
		IRenderedComponent<ProfilePage> cut = Render<ProfilePage>();

		// Assert
		IElement valueCell = cut.Find("tbody tr td:nth-child(2)");
		valueCell.ClassList.Should().Contain("wrap-anywhere");
	}
}
