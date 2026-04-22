# AdminSiteConfigApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminSiteConfigsGet**](#adminsiteconfigsget) | **GET** /admin/site-configs | 사이트 설정 목록 조회|
|[**adminSiteConfigsIdDelete**](#adminsiteconfigsiddelete) | **DELETE** /admin/site-configs/{id} | 사이트 설정 삭제|
|[**adminSiteConfigsIdGet**](#adminsiteconfigsidget) | **GET** /admin/site-configs/{id} | 사이트 설정 단건 조회|
|[**adminSiteConfigsKeyPatch**](#adminsiteconfigskeypatch) | **PATCH** /admin/site-configs/{key} | 사이트 설정 수정|
|[**adminSiteConfigsPost**](#adminsiteconfigspost) | **POST** /admin/site-configs | 사이트 설정 생성|

# **adminSiteConfigsGet**
> InternalApiHandlersAPIResponse adminSiteConfigsGet()


### Example

```typescript
import {
    AdminSiteConfigApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminSiteConfigApi(configuration);

const { status, data } = await apiInstance.adminSiteConfigsGet();
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

# **adminSiteConfigsIdDelete**
> InternalApiHandlersAPIResponse adminSiteConfigsIdDelete()


### Example

```typescript
import {
    AdminSiteConfigApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminSiteConfigApi(configuration);

let id: number; //설정 ID (default to undefined)

const { status, data } = await apiInstance.adminSiteConfigsIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 설정 ID | defaults to undefined|


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

# **adminSiteConfigsIdGet**
> InternalApiHandlersAPIResponse adminSiteConfigsIdGet()


### Example

```typescript
import {
    AdminSiteConfigApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminSiteConfigApi(configuration);

let id: number; //설정 ID (default to undefined)

const { status, data } = await apiInstance.adminSiteConfigsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 설정 ID | defaults to undefined|


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

# **adminSiteConfigsKeyPatch**
> InternalApiHandlersAPIResponse adminSiteConfigsKeyPatch(body)


### Example

```typescript
import {
    AdminSiteConfigApi,
    Configuration,
    InternalApiHandlersUpdateSiteConfigRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminSiteConfigApi(configuration);

let key: string; //설정 키 (default to undefined)
let body: InternalApiHandlersUpdateSiteConfigRequest; //변경할 값

const { status, data } = await apiInstance.adminSiteConfigsKeyPatch(
    key,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **InternalApiHandlersUpdateSiteConfigRequest**| 변경할 값 | |
| **key** | [**string**] | 설정 키 | defaults to undefined|


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

# **adminSiteConfigsPost**
> InternalApiHandlersAPIResponse adminSiteConfigsPost(body)


### Example

```typescript
import {
    AdminSiteConfigApi,
    Configuration,
    InternalApiHandlersCreateSiteConfigRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminSiteConfigApi(configuration);

let body: InternalApiHandlersCreateSiteConfigRequest; //설정 정보

const { status, data } = await apiInstance.adminSiteConfigsPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **InternalApiHandlersCreateSiteConfigRequest**| 설정 정보 | |


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

