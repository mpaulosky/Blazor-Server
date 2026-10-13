// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ProfilePageTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;
using System.Security.Claims;

using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Primitives;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Profile;

public class ProfilePageTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public ProfilePageTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[Fact]
	public async Task GetProfile_Visitor_IsChallengedBackToProfile()
	{
		// Arrange
		using HttpClient client =
			_factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/profile", UriKind.Relative), TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		Uri? location = response.Headers.Location;
		location.Should().NotBeNull();
		string locationText = location!.OriginalString;
		locationText.Should().StartWith(AuthenticationEndpoints.LoginPath);
		Dictionary<string, StringValues> query =
			QueryHelpers.ParseQuery(locationText[locationText.IndexOf('?', StringComparison.Ordinal)..]);
		query["returnUrl"].ToString().Should().Be("/profile");
	}

	[Fact]
	public async Task GetProfile_User_ReturnsOkShowingOwnClaimTypeAndValue()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		client.DefaultRequestHeaders.Add(TestAuthHandler.RoleClaimHeaderName, "Admin");

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/profile", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		html.Should().Contain(ClaimTypes.NameIdentifier);
		html.Should().Contain("a-user");
		html.Should().Contain(Auth0Options.DefaultRoleClaimType);
		html.Should().Contain("Admin");
	}

	[Fact]
	public async Task GetProfile_ClaimValueContainsMarkup_RendersItAsEscapedText()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		client.DefaultRequestHeaders.Add(TestAuthHandler.RoleClaimHeaderName, "<script>alert(1)</script>");

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/profile", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		html.Should().NotContain("<script>alert(1)</script>");
		html.Should().Contain("&lt;script&gt;alert(1)&lt;/script&gt;");
	}
}
