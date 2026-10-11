// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     WebAppCollectionDefinition.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

namespace UI.Tests.E2E.Fixtures;

/// <summary>
///     Shares one <see cref="WebAppFixture" /> across every test class in this assembly, so the AppHost and
///     Chromium start once.
/// </summary>
[CollectionDefinition(Name)]
public sealed class WebAppCollectionDefinition : ICollectionFixture<WebAppFixture>
{
	/// <summary>
	///     The name every E2E test class passes to <see cref="CollectionAttribute" />.
	/// </summary>
	public const string Name = "WebApp E2E";
}
