// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AdminNavLinkTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;

using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Admin;

public class AdminNavLinkTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public AdminNavLinkTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[Fact]
	public async Task GetHome_Admin_ShowsAdminLink()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "an-admin");
		client.DefaultRequestHeaders.Add(TestAuthHandler.RoleClaimHeaderName, "Admin");

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		html.Should().MatchRegex("<a[^>]*href=\"admin\"[^>]*>\\s*Admin\\s*</a>");
	}

	[Fact]
	public async Task GetHome_User_HidesAdminLink()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		html.Should().NotContain("href=\"admin\"");
	}

	[Fact]
	public async Task GetHome_Visitor_HidesAdminLink()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		html.Should().NotContain("href=\"admin\"");
	}
}
