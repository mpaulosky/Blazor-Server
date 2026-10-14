// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     BuildInfoRegistrationTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using Microsoft.Extensions.DependencyInjection;

using UI.Components.Layout;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Layout;

public class BuildInfoRegistrationTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public BuildInfoRegistrationTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	// Refs #348: BuildInfo must resolve from DI. The actual Release and commit vary by checkout, so this only
	// checks that resolution succeeds and is a singleton, not any particular tag or SHA.
	[Fact]
	public void Services_BuildInfo_ResolvesAsSingleton()
	{
		// Arrange

		// Act
		BuildInfo? first = _factory.Services.GetService<BuildInfo>();
		BuildInfo? second = _factory.Services.GetService<BuildInfo>();

		// Assert
		first.Should().NotBeNull();
		second.Should().BeSameAs(first);
	}
}
