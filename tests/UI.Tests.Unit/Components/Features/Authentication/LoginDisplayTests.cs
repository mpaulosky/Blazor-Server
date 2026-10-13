// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LoginDisplayTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

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

	private sealed class FakeAntiforgeryStateProvider : AntiforgeryStateProvider
	{
		public override AntiforgeryRequestToken? GetAntiforgeryToken() =>
			new("fake-antiforgery-token", "__RequestVerificationToken");
	}
}
