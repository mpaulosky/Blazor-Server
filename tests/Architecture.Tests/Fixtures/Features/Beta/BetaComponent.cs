// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     BetaComponent.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using Architecture.Tests.Fixtures.Features.Alpha;

namespace Architecture.Tests.Fixtures.Features.Beta;

internal sealed class BetaComponent
{
	internal readonly AlphaComponent Alpha = new();
}
