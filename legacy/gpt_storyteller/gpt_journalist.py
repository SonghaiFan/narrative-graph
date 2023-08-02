from datetime import date
from typing import List

from dotenv import load_dotenv, find_dotenv
from pydantic import BaseModel, Field, validator

from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
from langchain.llms import OpenAI
from langchain.chat_models import ChatOpenAI

# Load environment variables from .env file
load_dotenv(find_dotenv())


class Article(BaseModel):
    date: str = Field(
        description="Published date of the news article in date format.")
    title: str = Field(description="Title of the news article.")
    themes: List[str] = Field(description="Themes of the news article.")
    entity: List[str] = Field(description="Entity of the news article.")
    key_words: List[str] = Field(
        description="Key words of the news article, avoiding repetition of themes and entity.")
    lead_paragraph: str = Field(
        description="Lead paragraph of the news article, approximately 100 words in length.")


class ArticleCorpus(BaseModel):
    articles: List[Article] = Field(description="A list of news articles.")


def make_article_corpus(
    time_range: str, entities: str, themes: str, model_name: str = "gpt-4", temperature: int = 0
):
    article_corpus_parser = PydanticOutputParser(pydantic_object=ArticleCorpus)

    prompt_template = """
    You are an experienced New York Times journalist, adept at crafting in-depth, well-researched short articles around 
    specific entities or themes. Your writing is clear, concise, and engaging, upholding the highest journalistic standards. 
    
    Time Range: {time_range}
    Entities: {entities}
    Themes: {themes}
    
    You are writing a corpus of news articles covering at least one of the entities or topics listed above in the timeframe.
    Multiple entities and topics may be included in a single article. Each news article corpus should contain 2-5 articles. 
    The articles in the corpus should be closely centred on common entities and themes.
    {format_instructions}
    """

    model = OpenAI(model_name=model_name, temperature=temperature)
    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["time_range", "entities", "themes"],
        partial_variables={
            "format_instructions": article_corpus_parser.get_format_instructions()},
    )

    formatted_prompt = prompt.format_prompt(
        time_range=time_range,
        entities=entities,
        themes=themes,
    )

    output = model(formatted_prompt.to_string())
    article_corpus = article_corpus_parser.parse(output)

    return article_corpus
