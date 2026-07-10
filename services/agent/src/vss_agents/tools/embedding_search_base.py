class EmbeddingSearchBase:
    async def search_by_vector(
        self,
        query_vector: list[float],
        max_results: int,
        sensor_ids: list[str] | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> list[dict]:
        ...

class EmbedSearchTool(EmbeddingSearchBase):
    async def search_text(self, query: str):
        vector = await self.create_text_embedding(query)
        return await self.search_by_vector(vector, ...)
    
class ImageSearchTool(EmbeddingSearchBase):
    async def search_image(self, image: bytes):
        vector = await self.create_image_embedding(image)
        return await self.search_by_vector(vector, ...)