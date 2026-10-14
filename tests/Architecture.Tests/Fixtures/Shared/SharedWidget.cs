// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SharedWidget.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using Architecture.Tests.Fixtures.Features.Alpha;

namespace Architecture.Tests.Fixtures.Shared;

internal sealed class SharedWidget
{
	internal readonly AlphaComponent Alpha = new();
}
