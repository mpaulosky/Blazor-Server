// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ProfileNavLinkTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;

using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Profile;

public class ProfileNavLinkTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public ProfileNavLinkTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[Fact]
	public async Task GetHome_User_ShowsProfileLink()
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
		html.Should().Contain("href=\"profile\"");
		html.Should().Contain("Profile");
	}

	[Fact]
	public async Task GetHome_Visitor_HidesProfileLink()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		html.Should().NotContain("href=\"profile\"");
	}
}
