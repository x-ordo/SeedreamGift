# AdminBrandsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminBrandsCodeDelete**](#adminbrandscodedelete) | **DELETE** /admin/brands/{code} | 브랜드 삭제|
|[**adminBrandsCodePatch**](#adminbrandscodepatch) | **PATCH** /admin/brands/{code} | 브랜드 수정|
|[**adminBrandsGet**](#adminbrandsget) | **GET** /admin/brands | 브랜드 목록 조회|
|[**adminBrandsPost**](#adminbrandspost) | **POST** /admin/brands | 브랜드 생성|

# **adminBrandsCodeDelete**
> InternalApiHandlersAPIResponse adminBrandsCodeDelete()


### Example

```typescript
import {
    AdminBrandsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminBrandsApi(configuration);

let code: string; //브랜드 코드 (default to undefined)

const { status, data } = await apiInstance.adminBrandsCodeDelete(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | 브랜드 코드 | defaults to undefined|


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

# **adminBrandsCodePatch**
> InternalApiHandlersAPIResponse adminBrandsCodePatch(body)


### Example

```typescript
import {
    AdminBrandsApi,
    Configuration,
    WGiftServerInternalDomainBrand
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminBrandsApi(configuration);

let code: string; //브랜드 코드 (default to undefined)
let body: WGiftServerInternalDomainBrand; //브랜드 정보

const { status, data } = await apiInstance.adminBrandsCodePatch(
    code,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainBrand**| 브랜드 정보 | |
| **code** | [**string**] | 브랜드 코드 | defaults to undefined|


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

# **adminBrandsGet**
> InternalApiHandlersAPIResponse adminBrandsGet()


### Example

```typescript
import {
    AdminBrandsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminBrandsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminBrandsGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|


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

# **adminBrandsPost**
> InternalApiHandlersAPIResponse adminBrandsPost(body)


### Example

```typescript
import {
    AdminBrandsApi,
    Configuration,
    WGiftServerInternalDomainBrand
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminBrandsApi(configuration);

let body: WGiftServerInternalDomainBrand; //브랜드 정보

const { status, data } = await apiInstance.adminBrandsPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainBrand**| 브랜드 정보 | |


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

