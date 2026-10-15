// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LoginDisplayTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using System.Security.Claims;

using AngleSharp.Dom;

using Bunit.TestDoubles;

using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Forms;
using Microsoft.Extensions.DependencyInjection;

using UI.Components.Features.Authentication;

namespace UI.Tests.Unit.Components.Features.Authentication;

public class LoginDisplayTests : BunitContext
{
	public LoginDisplayTests()
	{
		Services.AddSingleton<AntiforgeryStateProvider>(new FakeAntiforgeryStateProvider());
	}

	[Fact]
	public void Render_Visitor_ShowsLogInLinkWithReturnUrlAndDisabledEnhancedNav()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		IElement link = cut.Find("a");
		link.GetAttribute("href").Should().Be("authentication/login?returnUrl=%2F");
		link.GetAttribute("data-enhance-nav").Should().Be("false");
		link.TextContent.Trim().Should().Be("Log in");
		cut.FindAll("form").Should().BeEmpty();
	}

	[Fact]
	public void Render_Visitor_LogInPillHoverBorderStandsOutFromItsResting()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		// The resting border is accent-200 / dark accent-700, so the hover steps clear of both (docs/plans/palette-tint.md).
		cut.Find("a").ClassList.Should()
			.Contain(["border-accent-200", "hover:border-accent-400", "dark:border-accent-700", "dark:hover:border-accent-400"]);
	}

	[Fact]
	public void Render_User_ShowsLogOutFormAndNoLogInLink()
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user");

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		IElement form = cut.Find("form");
		form.GetAttribute("method").Should().Be("post");
		form.GetAttribute("action").Should().Be("authentication/logout");
		IElement button = cut.Find("form button[type='submit']");
		button.TextContent.Trim().Should().Be("Log out");
		cut.FindAll("a").Should().BeEmpty();
	}

	[Theory]
	[InlineData("counter?page=2", "%2Fcounter%3Fpage%3D2")]
	[InlineData("authentication/access-denied?ReturnUrl=%2Fadmin", "%2F")]
	public void Render_VisitorOnPage_LogInLinkReturnsToTheRightPage(string relativeUri, string expectedReturnUrl)
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();
		Services.GetRequiredService<NavigationManager>().NavigateTo(relativeUri);

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		cut.Find("a").GetAttribute("href").Should().Be($"authentication/login?returnUrl={expectedReturnUrl}");
	}

	[Fact]
	public void Render_User_NameClaimSet_ShowsWelcomeWithNameBeforeLogOut()
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user").SetClaims(new Claim("name", "Jane Doe"));

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		cut.Find("span").TextContent.Should().Be("Welcome! Jane Doe");
		cut.Markup.IndexOf("Welcome!", StringComparison.Ordinal).Should()
			.BeGreaterThanOrEqualTo(0)
			.And.BeLessThan(cut.Markup.IndexOf("<form", StringComparison.Ordinal));
	}

	[Fact]
	public void Render_User_OnlyNicknameClaimSet_ShowsWelcomeWithNickname()
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user").SetClaims(new Claim("nickname", "jd"));

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		cut.Find("span").TextContent.Should().Be("Welcome! jd");
	}

	[Fact]
	public void Render_User_OnlyEmailClaimSet_ShowsWelcomeWithEmail()
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user").SetClaims(new Claim("email", "jane@example.com"));

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		cut.Find("span").TextContent.Should().Be("Welcome! jane@example.com");
	}

	[Theory]
	[InlineData("", "", "jane@example.com", "jane@example.com")]
	[InlineData("   ", "Janie", "jane@example.com", "Janie")]
	[InlineData("Jane Doe", "Janie", "jane@example.com", "Jane Doe")]
	public void Render_User_EmptyOrWhitespaceClaims_AreSkipped(string name, string nickname, string email,
		string expectedName)
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user")
			.SetClaims(new Claim("name", name), new Claim("nickname", nickname), new Claim("email", email));

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		cut.Find("span").TextContent.Should().Be($"Welcome! {expectedName}");
	}

	[Fact]
	public void Render_Visitor_ShowsNoWelcomeText()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		cut.Markup.Should().NotContain("Welcome!");
	}

	[Theory]
	[InlineData(null)]
	[InlineData(" ")]
	public void Render_User_NoUsableGreetingClaim_ShowsLogOutWithoutWelcome(string? name)
	{
		// Arrange
		BunitAuthorizationContext authorization = AddAuthorization().SetAuthorized("test-user");
		if (name is not null)
		{
			authorization.SetClaims(new Claim("name", name));
		}

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		cut.Markup.Should().NotContain("Welcome!");
		cut.Find("button[type=submit]").TextContent.Should().Be("Log out");
	}

	[Fact]
	public void Render_User_LongName_TruncatesTheGreetingAndKeepsTheFullNameInItsTitle()
	{
		// Arrange
		string longName = new('x', 200);
		AddAuthorization().SetAuthorized("test-user").SetClaims(new Claim("name", longName));

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		IElement greeting = cut.Find("span");
		greeting.ClassList.Should().Contain(["truncate", "max-w-48"]);
		greeting.GetAttribute("title").Should().Be(longName);
	}

	[Fact]
	public void Render_User_NameClaimContainsHtml_ShowsNameEscaped()
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user").SetClaims(new Claim("name", "<b>Jane</b>"));

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		cut.FindAll("b").Should().BeEmpty();
		cut.Find("span").TextContent.Should().Be("Welcome! <b>Jane</b>");
	}

	[Theory]
	[InlineData("Jane Doe")]
	[InlineData("محمد علي")]
	public void Render_User_NameClaimSet_IsolatesTheNamesTextDirection(string name)
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user").SetClaims(new Claim("name", name));

		// Act
		IRenderedComponent<LoginDisplay> cut = Render<LoginDisplay>();

		// Assert
		// A right-to-left name outside a <bdi> would reorder the "Welcome!" around it.
		cut.Find("span > bdi").TextContent.Should().Be(name);
	}

	private sealed class FakeAntiforgeryStateProvider : AntiforgeryStateProvider
	{
		public override AntiforgeryRequestToken? GetAntiforgeryToken() =>
			new("fake-antiforgery-token", "__RequestVerificationToken");
	}
}
