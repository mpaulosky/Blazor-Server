// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     TimeProviderRegistrationTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using Microsoft.Extensions.DependencyInjection;

using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration;

public class TimeProviderRegistrationTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public TimeProviderRegistrationTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[Fact]
	public void Services_TimeProvider_ResolvesToSystemTimeProvider()
	{
		// Arrange

		// Act
		TimeProvider? timeProvider = _factory.Services.GetService<TimeProvider>();

		// Assert
		timeProvider.Should().BeSameAs(TimeProvider.System);
	}
}
