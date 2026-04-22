# AdminUsersApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminStatsGet**](#adminstatsget) | **GET** /admin/stats | 대시보드 통계 조회|
|[**adminUsersGet**](#adminusersget) | **GET** /admin/users | 회원 목록 조회|
|[**adminUsersIdDelete**](#adminusersiddelete) | **DELETE** /admin/users/{id} | 회원 삭제|
|[**adminUsersIdGet**](#adminusersidget) | **GET** /admin/users/{id} | 회원 상세 조회|
|[**adminUsersIdKycPatch**](#adminusersidkycpatch) | **PATCH** /admin/users/{id}/kyc | 회원 KYC 상태 변경|
|[**adminUsersIdPasswordPatch**](#adminusersidpasswordpatch) | **PATCH** /admin/users/{id}/password | 회원 비밀번호 초기화|
|[**adminUsersIdPatch**](#adminusersidpatch) | **PATCH** /admin/users/{id} | 회원 정보 수정|
|[**adminUsersIdRolePatch**](#adminusersidrolepatch) | **PATCH** /admin/users/{id}/role | 회원 역할 변경|
|[**adminUsersPost**](#adminuserspost) | **POST** /admin/users | 회원 생성|

# **adminStatsGet**
> InternalApiHandlersAPIResponse adminStatsGet()


### Example

```typescript
import {
    AdminUsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminUsersApi(configuration);

const { status, data } = await apiInstance.adminStatsGet();
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

# **adminUsersGet**
> InternalApiHandlersAPIResponse adminUsersGet()


### Example

```typescript
import {
    AdminUsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminUsersApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)
let kycStatus: string; //KYC 상태 필터 (optional) (default to undefined)
let role: string; //역할 필터 (optional) (default to undefined)

const { status, data } = await apiInstance.adminUsersGet(
    page,
    limit,
    kycStatus,
    role
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|
| **kycStatus** | [**string**] | KYC 상태 필터 | (optional) defaults to undefined|
| **role** | [**string**] | 역할 필터 | (optional) defaults to undefined|


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminUsersIdDelete**
> InternalApiHandlersAPIResponse adminUsersIdDelete()


### Example

```typescript
import {
    AdminUsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminUsersApi(configuration);

let id: number; //회원 ID (default to undefined)

const { status, data } = await apiInstance.adminUsersIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 회원 ID | defaults to undefined|


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminUsersIdGet**
> InternalApiHandlersAPIResponse adminUsersIdGet()


### Example

```typescript
import {
    AdminUsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminUsersApi(configuration);

let id: number; //회원 ID (default to undefined)

const { status, data } = await apiInstance.adminUsersIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 회원 ID | defaults to undefined|


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminUsersIdKycPatch**
> InternalApiHandlersAPIResponse adminUsersIdKycPatch(body)


### Example

```typescript
import {
    AdminUsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminUsersApi(configuration);

let id: number; //회원 ID (default to undefined)
let body: object; //KYC 상태

const { status, data } = await apiInstance.adminUsersIdKycPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| KYC 상태 | |
| **id** | [**number**] | 회원 ID | defaults to undefined|


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminUsersIdPasswordPatch**
> InternalApiHandlersAPIResponse adminUsersIdPasswordPatch(body)


### Example

```typescript
import {
    AdminUsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminUsersApi(configuration);

let id: number; //회원 ID (default to undefined)
let body: object; //새 비밀번호

const { status, data } = await apiInstance.adminUsersIdPasswordPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 새 비밀번호 | |
| **id** | [**number**] | 회원 ID | defaults to undefined|


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminUsersIdPatch**
> InternalApiHandlersAPIResponse adminUsersIdPatch(body)


### Example

```typescript
import {
    AdminUsersApi,
    Configuration,
    WGiftServerInternalDomainUser
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminUsersApi(configuration);

let id: number; //회원 ID (default to undefined)
let body: WGiftServerInternalDomainUser; //회원 정보

const { status, data } = await apiInstance.adminUsersIdPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainUser**| 회원 정보 | |
| **id** | [**number**] | 회원 ID | defaults to undefined|


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminUsersIdRolePatch**
> InternalApiHandlersAPIResponse adminUsersIdRolePatch(body)


### Example

```typescript
import {
    AdminUsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminUsersApi(configuration);

let id: number; //회원 ID (default to undefined)
let body: object; //역할 정보

const { status, data } = await apiInstance.adminUsersIdRolePatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 역할 정보 | |
| **id** | [**number**] | 회원 ID | defaults to undefined|


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminUsersPost**
> InternalApiHandlersAPIResponse adminUsersPost(body)


### Example

```typescript
import {
    AdminUsersApi,
    Configuration,
    WGiftServerInternalDomainUser
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminUsersApi(configuration);

let body: WGiftServerInternalDomainUser; //회원 정보

const { status, data } = await apiInstance.adminUsersPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainUser**| 회원 정보 | |


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
|**201** | Created |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

