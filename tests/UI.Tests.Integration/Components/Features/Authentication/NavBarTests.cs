// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     NavBarTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;

using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

public class NavBarTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public NavBarTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[Fact]
	public async Task GetHome_Visitor_ShowsLogInAndNoLogOutOrWelcomeText()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		html.Should().Contain("Log in");
		html.Should().NotContain("Log out");
		html.Should().NotContain("Welcome!");
	}

	[Fact]
	public async Task GetHome_User_ShowsLogOut()
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
		html.Should().Contain("Log out");
	}

	[Fact]
	public async Task GetHome_User_ShowsWelcomeWithName()
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
		html.Should().Contain("Welcome! <bdi>a-user</bdi>");
		html.Should().Contain("Log out");
	}
}
