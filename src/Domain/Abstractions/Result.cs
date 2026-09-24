// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     Result.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Domain
// =============================================

using System.Diagnostics.CodeAnalysis;

namespace Domain.Abstractions;

/// <summary>
///     Describes the category of error represented by a failed result.
/// </summary>
public enum ResultErrorCode
{
	/// <summary>
	///     Indicates that no error occurred.
	/// </summary>
	None = 0,

	/// <summary>
	///     Indicates that the operation failed because the persisted data changed concurrently.
	/// </summary>
	Concurrency = 1,

	/// <summary>
	///     Indicates that the requested resource could not be found.
	/// </summary>
	NotFound = 2,

	/// <summary>
	///     Indicates that input validation failed.
	/// </summary>
	Validation = 3,

	/// <summary>
	///     Indicates that the operation conflicts with the current resource state.
	/// </summary>
	Conflict = 4,

	/// <summary>
	///     Indicates that the caller is not authorized to complete the operation.
	/// </summary>
	Unauthorized = 5
}

/// <summary>
///     Represents the success or failure outcome of a domain operation.
/// </summary>
public class Result
{
	/// <summary>
	///     Initializes a new instance of the <see cref="Result" /> class.
	/// </summary>
	/// <param name="success">Whether the operation succeeded.</param>
	/// <param name="errorMessage">The optional failure message.</param>
	/// <param name="errorCode">The optional failure category.</param>
	/// <param name="details">Optional structured failure details.</param>
	protected Result(bool success, string? errorMessage = null, ResultErrorCode errorCode = ResultErrorCode.None,
		object? details = null)
	{
		Success = success;
		Error = errorMessage;
		ErrorCode = errorCode;
		Details = details;
	}

	/// <summary>
	///     Gets a value indicating whether the operation succeeded.
	/// </summary>
	public bool Success { get; }

	/// <summary>
	///     Gets a value indicating whether the operation failed.
	/// </summary>
	public bool Failure => !Success;

	/// <summary>
	///     Gets the failure message, when the operation failed.
	/// </summary>
	public string? Error { get; }

	/// <summary>
	///     Gets the failure category for this result.
	/// </summary>
	public ResultErrorCode ErrorCode { get; }

	/// <summary>
	///     Gets optional structured error details, such as the server version on a concurrency conflict.
	/// </summary>
	public object? Details { get; }

	/// <summary>
	///     Creates a successful result with no value.
	/// </summary>
	/// <returns>A successful <see cref="Result" />.</returns>
	public static Result Ok()
	{
		return new Result(true);
	}

	/// <summary>
	///     Creates a failed result with an error message.
	/// </summary>
	/// <param name="errorMessage">The failure message.</param>
	/// <returns>A failed <see cref="Result" />.</returns>
	public static Result Fail(string errorMessage)
	{
		return new Result(false, errorMessage);
	}

	/// <summary>
	///     Creates a failed result with an error message and category.
	/// </summary>
	/// <param name="errorMessage">The failure message.</param>
	/// <param name="code">The failure category.</param>
	/// <returns>A failed <see cref="Result" />.</returns>
	public static Result Fail(string errorMessage, ResultErrorCode code)
	{
		return new Result(false, errorMessage, code);
	}

	/// <summary>
	///     Creates a failed result with an error message, category, and structured details.
	/// </summary>
	/// <param name="errorMessage">The failure message.</param>
	/// <param name="code">The failure category.</param>
	/// <param name="details">Structured details that describe the failure.</param>
	/// <returns>A failed <see cref="Result" />.</returns>
	public static Result Fail(string errorMessage, ResultErrorCode code, object? details)
	{
		return new Result(false, errorMessage, code, details);
	}

	/// <summary>
	///     Creates a successful result that carries a value.
	/// </summary>
	/// <typeparam name="T">The value type.</typeparam>
	/// <param name="value">The result value.</param>
	/// <returns>A successful <see cref="Result{T}" />.</returns>
	public static Result<T> Ok<T>(T value)
	{
		return new Result<T>(value, true);
	}

	/// <summary>
	///     Creates a failed typed result with an error message.
	/// </summary>
	/// <typeparam name="T">The value type.</typeparam>
	/// <param name="errorMessage">The failure message.</param>
	/// <returns>A failed <see cref="Result{T}" />.</returns>
	public static Result<T> Fail<T>(string errorMessage)
	{
		return new Result<T>(default, false, errorMessage);
	}

	/// <summary>
	///     Creates a failed typed result with an error message and category.
	/// </summary>
	/// <typeparam name="T">The value type.</typeparam>
	/// <param name="errorMessage">The failure message.</param>
	/// <param name="code">The failure category.</param>
	/// <returns>A failed <see cref="Result{T}" />.</returns>
	public static Result<T> Fail<T>(string errorMessage, ResultErrorCode code)
	{
		return new Result<T>(default, false, errorMessage, code);
	}

	/// <summary>
	///     Creates a failed typed result with an error message, category, and structured details.
	/// </summary>
	/// <typeparam name="T">The value type.</typeparam>
	/// <param name="errorMessage">The failure message.</param>
	/// <param name="code">The failure category.</param>
	/// <param name="details">Structured details that describe the failure.</param>
	/// <returns>A failed <see cref="Result{T}" />.</returns>
	public static Result<T> Fail<T>(string errorMessage, ResultErrorCode code, object? details)
	{
		return new Result<T>(default, false, errorMessage, code, details);
	}

	/// <summary>
	///     Creates a successful typed result when a value is present; otherwise, creates a failed result.
	/// </summary>
	/// <typeparam name="T">The value type.</typeparam>
	/// <param name="value">The value to wrap.</param>
	/// <returns>A typed result containing the value, or a validation failure when the value is null.</returns>
	public static Result<T> FromValue<T>(T? value)
	{
		return Result<T>.FromValue(value);
	}
}

/// <summary>
///     Represents the success or failure outcome of a domain operation that returns a value.
/// </summary>
/// <typeparam name="T">The value type.</typeparam>
public sealed class Result<T> : Result
{
	/// <summary>
	///     Initializes a new instance of the <see cref="Result{T}" /> class.
	/// </summary>
	/// <param name="value">The operation value.</param>
	/// <param name="success">Whether the operation succeeded.</param>
	/// <param name="errorMessage">The optional failure message.</param>
	/// <param name="errorCode">The optional failure category.</param>
	/// <param name="details">Optional structured failure details.</param>
	internal Result(T? value, bool success, string? errorMessage = null, ResultErrorCode errorCode = ResultErrorCode.None,
		object? details = null)
		: base(success, errorMessage, errorCode, details)
	{
		Value = value;
	}

	private const string NullValueError = "Value cannot be null.";

	/// <summary>
	///     Gets the operation value when the result is successful.
	/// </summary>
	public T? Value { get; }

	/// <summary>
	///     Returns the wrapped value.
	/// </summary>
	/// <returns>The wrapped value, or the default value when none is present.</returns>
	public T? ToValue() => Value;

	private static Result<T> Ok(T? value)
	{
		return new Result<T>(value, true);
	}

	// Suppress CA1000: static members on generic types are intentional here to provide
	// a type-inferred factory API consistent with the non-generic Result base class.
#pragma warning disable CA1000 // Do not declare static members on generic types
	/// <summary>
	///     Creates a successful result when a value is present; otherwise, creates a failed result.
	/// </summary>
	/// <param name="value">The value to wrap.</param>
	/// <returns>A typed result containing the value, or a validation failure when the value is null.</returns>
	public static Result<T> FromValue(T? value)
	{
		return value is null ? Fail(NullValueError, ResultErrorCode.Validation) : Ok(value);
	}

	/// <summary>
	///     Creates a failed typed result with an error message.
	/// </summary>
	/// <param name="errorMessage">The failure message.</param>
	/// <returns>A failed <see cref="Result{T}" />.</returns>
	public static new Result<T> Fail(string errorMessage)
	{
		return new Result<T>(default, false, errorMessage);
	}

	/// <summary>
	///     Creates a failed typed result with an error message and category.
	/// </summary>
	/// <param name="errorMessage">The failure message.</param>
	/// <param name="code">The failure category.</param>
	/// <returns>A failed <see cref="Result{T}" />.</returns>
	public static new Result<T> Fail(string errorMessage, ResultErrorCode code)
	{
		return new Result<T>(default, false, errorMessage, code);
	}

	/// <summary>
	///     Creates a failed typed result with an error message, category, and structured details.
	/// </summary>
	/// <param name="errorMessage">The failure message.</param>
	/// <param name="code">The failure category.</param>
	/// <param name="details">Structured details that describe the failure.</param>
	/// <returns>A failed <see cref="Result{T}" />.</returns>
	public static new Result<T> Fail(string errorMessage, ResultErrorCode code, object? details)
	{
		return new Result<T>(default, false, errorMessage, code, details);
	}
#pragma warning restore CA1000 // Do not declare static members on generic types

	// CA2225 does not recognize Result<T>.ToValue()/FromValue() as valid alternates for
	// these generic implicit conversions, so suppress the warning only on the operators.
	/// <summary>
	///     Converts a result to its wrapped value.
	/// </summary>
	/// <param name="result">The result to convert.</param>
	[SuppressMessage("Usage", "CA2225:Operator overloads have named alternates",
		Justification =
			"Result<T> already exposes ToValue()/FromValue() named conversion APIs; the implicit conversions are kept intentionally for application ergonomics.")]
	public static implicit operator T?(Result<T>? result)
	{
		if (result is null)
		{
			// Return the language default for T? when the Result is null. For value types this will
			// be the underlying default (e.g., 0 for int) which matches existing behavior.
			return default;
		}

		return result.Value;
	}

	/// <summary>
	///     Converts a value to a successful result, or to a failed result when the value is null.
	/// </summary>
	/// <param name="value">The value to wrap.</param>
	[SuppressMessage("Usage", "CA2225:Operator overloads have named alternates",
		Justification =
			"Result<T> already exposes ToValue()/FromValue() named conversion APIs; the implicit conversions are kept intentionally for application ergonomics.")]
	public static implicit operator Result<T>(T? value)
	{
		return FromValue(value);
	}
}
