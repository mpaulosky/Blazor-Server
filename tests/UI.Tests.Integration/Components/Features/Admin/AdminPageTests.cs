// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AdminPageTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;

using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Primitives;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Admin;

public class AdminPageTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public AdminPageTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[Fact]
	public async Task GetAdmin_Visitor_IsChallengedBackToAdmin()
	{
		// Arrange
		using HttpClient client =
			_factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/admin", UriKind.Relative), TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		Uri? location = response.Headers.Location;
		location.Should().NotBeNull();
		string locationText = location!.OriginalString;
		locationText.Should().StartWith(AuthenticationEndpoints.LoginPath);
		Dictionary<string, StringValues> query =
			QueryHelpers.ParseQuery(locationText[locationText.IndexOf('?', StringComparison.Ordinal)..]);
		query["returnUrl"].ToString().Should().Be("/admin");
	}

	[Fact]
	public async Task GetAdmin_UserWithoutAdminRole_ReturnsForbiddenShowingAccessDeniedPage()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		client.DefaultRequestHeaders.Add(TestAuthHandler.RoleClaimHeaderName, "User");

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/admin", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
		html.Should().Contain("Access denied");
	}

	[Fact]
	public async Task GetAdmin_Admin_ReturnsOkShowingAdminPage()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "an-admin");
		client.DefaultRequestHeaders.Add(TestAuthHandler.RoleClaimHeaderName, "Admin");

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/admin", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		html.Should().Contain("Admin");
	}
}
