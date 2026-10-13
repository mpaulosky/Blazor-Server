// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LoginDisplayTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

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
		link.GetAttribute("href").Should().Be($"{AuthenticationEndpoints.LoginPath}?returnUrl=%2F");
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
		form.GetAttribute("action").Should().Be(AuthenticationEndpoints.LogoutPath);
		IElement button = cut.Find("form button[type='submit']");
		button.TextContent.Trim().Should().Be("Log out");
		cut.FindAll("a").Should().BeEmpty();
	}

	private sealed class FakeAntiforgeryStateProvider : AntiforgeryStateProvider
	{
		public override AntiforgeryRequestToken? GetAntiforgeryToken() =>
			new("fake-antiforgery-token", "__RequestVerificationToken");
	}
}
