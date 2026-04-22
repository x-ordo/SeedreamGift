# AuthApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**authForgotPasswordPost**](#authforgotpasswordpost) | **POST** /auth/forgot-password | 비밀번호 재설정 토큰 발급|
|[**authLoginMfaPost**](#authloginmfapost) | **POST** /auth/login/mfa | MFA 2단계 로그인|
|[**authLoginPost**](#authloginpost) | **POST** /auth/login | 로그인|
|[**authLogoutPost**](#authlogoutpost) | **POST** /auth/logout | 로그아웃|
|[**authMeGet**](#authmeget) | **GET** /auth/me | 내 정보 조회|
|[**authPasswordPatch**](#authpasswordpatch) | **PATCH** /auth/password | 비밀번호 변경|
|[**authProfilePatch**](#authprofilepatch) | **PATCH** /auth/profile | 프로필 수정|
|[**authRefreshPost**](#authrefreshpost) | **POST** /auth/refresh | 토큰 갱신 (쿠키 기반)|
|[**authRegisterPost**](#authregisterpost) | **POST** /auth/register | 회원가입|
|[**authResetPasswordPost**](#authresetpasswordpost) | **POST** /auth/reset-password | 비밀번호 재설정|
|[**authSessionsDelete**](#authsessionsdelete) | **DELETE** /auth/sessions | 다른 모든 세션 삭제|
|[**authSessionsGet**](#authsessionsget) | **GET** /auth/sessions | 활성 세션 목록 조회|
|[**authSessionsIdDelete**](#authsessionsiddelete) | **DELETE** /auth/sessions/{id} | 특정 세션 삭제|

# **authForgotPasswordPost**
> InternalApiHandlersAPIResponse authForgotPasswordPost(body)


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //이메일 주소

const { status, data } = await apiInstance.authForgotPasswordPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 이메일 주소 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLoginMfaPost**
> InternalApiHandlersAPIResponse authLoginMfaPost(body)


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //MFA 토큰 및 TOTP 코드

const { status, data } = await apiInstance.authLoginMfaPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| MFA 토큰 및 TOTP 코드 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLoginPost**
> InternalApiHandlersAPIResponse authLoginPost(body)


### Example

```typescript
import {
    AuthApi,
    Configuration,
    InternalApiHandlersLoginRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: InternalApiHandlersLoginRequest; //로그인 정보

const { status, data } = await apiInstance.authLoginPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **InternalApiHandlersLoginRequest**| 로그인 정보 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLogoutPost**
> InternalApiHandlersAPIResponse authLogoutPost()


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

const { status, data } = await apiInstance.authLogoutPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authMeGet**
> InternalApiHandlersAPIResponse authMeGet()


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

const { status, data } = await apiInstance.authMeGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authPasswordPatch**
> InternalApiHandlersAPIResponse authPasswordPatch(body)


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //기존/새 비밀번호

const { status, data } = await apiInstance.authPasswordPatch(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 기존/새 비밀번호 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authProfilePatch**
> InternalApiHandlersAPIResponse authProfilePatch(body)


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //수정할 프로필 필드 (key-value)

const { status, data } = await apiInstance.authProfilePatch(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 수정할 프로필 필드 (key-value) | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**409** | Conflict |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authRefreshPost**
> InternalApiHandlersAPIResponse authRefreshPost()


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

const { status, data } = await apiInstance.authRefreshPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authRegisterPost**
> InternalApiHandlersAPIResponse authRegisterPost(body)


### Example

```typescript
import {
    AuthApi,
    Configuration,
    WGiftServerInternalDomainUser
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: WGiftServerInternalDomainUser; //회원가입 정보

const { status, data } = await apiInstance.authRegisterPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainUser**| 회원가입 정보 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Created |  -  |
|**400** | Bad Request |  -  |
|**409** | Conflict |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authResetPasswordPost**
> InternalApiHandlersAPIResponse authResetPasswordPost(body)


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let body: object; //이메일, 재설정 토큰, 새 비밀번호

const { status, data } = await apiInstance.authResetPasswordPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 이메일, 재설정 토큰, 새 비밀번호 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authSessionsDelete**
> InternalApiHandlersAPIResponse authSessionsDelete()


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

const { status, data } = await apiInstance.authSessionsDelete();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authSessionsGet**
> InternalApiHandlersAPIResponse authSessionsGet()


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

const { status, data } = await apiInstance.authSessionsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authSessionsIdDelete**
> InternalApiHandlersAPIResponse authSessionsIdDelete()


### Example

```typescript
import {
    AuthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let id: number; //세션 ID (default to undefined)

const { status, data } = await apiInstance.authSessionsIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 세션 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

