import os
import datetime
import logging
from .makers.content_generator import generate_batch_video_queries, generate_batch_image_prompts, generate_comprehensive_content
from .makers.shorts_maker_V import YTShortsCreator_V
from .makers.shorts_maker_I import YTShortsCreator_I
from .makers.thumbnail import ThumbnailGenerator
from .helpers.minor_helper import ensure_output_directory, parse_script_to_cards, cleanup_temp_directories

logger = logging.getLogger(__name__)

def generate_youtube_short(topic: str, max_duration: int, background_type: str, background_source: str, background_path: str, style: str = "photorealistic", progress_callback=None):
    """
    Generate a YouTube Short.
    This function creates the video and thumbnail but does not upload them.
    """
    try:
        # Determine creator type from background_type
        if background_type == 'video':
            creator = YTShortsCreator_V()
        else:
            creator = YTShortsCreator_I()

        output_dir = ensure_output_directory()
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

        logger.info(f"Generating comprehensive content for : {topic}")
        content_package = generate_comprehensive_content(topic, max_tokens=800)

        script = content_package["script"]
        title = f"LazyCreator presents: {content_package['title']}"
        
        logger.info("Content package generated successfully:")
        logger.info(f"Title: {title}")

        safe_title = title.replace(' ', '_').replace(':', '').replace('?', '').replace('!', '')[:30]
        output_filename = f"yt_shorts_{safe_title}_{timestamp}.mp4"
        output_path = os.path.join(output_dir, output_filename)

        script_cards = parse_script_to_cards(script)
        logger.info(f"Script parsed into {len(script_cards)} sections")

        intro_card = {
            "text": f"LazyCreator presents: {content_package['title']}",
            "duration": 3,
            "voice_style": "excited"
        }
        script_cards.insert(0, intro_card)

        card_texts = [card['text'] for card in script_cards]

        if isinstance(creator, YTShortsCreator_V):
            logger.info("Generating video search queries for each section using AI...")
            batch_query_results = generate_batch_video_queries(card_texts, overall_topic=topic, model="gpt-4o-mini-2024-07-18")
        else:
            logger.info("Generating image search prompts for each section using AI...")
            batch_query_results = generate_batch_image_prompts(card_texts, overall_topic=topic, model="gpt-4o-mini-2024-07-18")

        default_query = f"abstract {topic}"
        section_queries = []
        for i in range(len(script_cards)):
            query = batch_query_results.get(i, default_query)
            if not query:
                 query = default_query
            section_queries.append(query)

        fallback_query = section_queries[0] if section_queries else default_query

        video_path = creator.create_youtube_short(
            title=title,
            script_sections=script_cards,
            background_query=fallback_query,
            output_filename=output_path,
            style=style,
            voice_style="none",
            max_duration=max_duration,
            background_queries=section_queries,
            blur_background=False,
            edge_blur=False,
            custom_background_path=background_path
        )

        thumbnail_path = None
        try:
            logger.info("Generating thumbnail for the short")
            thumbnail_dir = os.path.join(output_dir, "thumbnails")
            os.makedirs(thumbnail_dir, exist_ok=True)
            thumbnail_generator = ThumbnailGenerator(output_dir=thumbnail_dir)
            safe_title_thumbnail = safe_title[:20]
            thumbnail_output_path = os.path.join(
                thumbnail_dir,
                f"thumbnail_{safe_title_thumbnail}_{timestamp}.jpg"
            )
            thumbnail_path = thumbnail_generator.generate_thumbnail(
                title=title,
                script_sections=script_cards,
                prompt=content_package["thumbnail_hf_prompt"],
                style=style,
                output_path=thumbnail_output_path
            )
            if not thumbnail_path:
                logger.info(f"Attempting with Unsplash query: {content_package['thumbnail_unsplash_query']}")
                unsplash_image_path = thumbnail_generator.fetch_image_unsplash(content_package['thumbnail_unsplash_query'])
                if unsplash_image_path:
                    thumbnail_path = thumbnail_generator.create_thumbnail(
                        title=title,
                        image_path=unsplash_image_path,
                        output_path=thumbnail_output_path
                    )
            thumbnail_generator.cleanup()
        except Exception as thumbnail_error:
            logger.error(f"Failed to generate thumbnail: {thumbnail_error}")

        # Return the paths and the content package
        return video_path, thumbnail_path, content_package

    except Exception as e:
        logger.error(f"Error generating YouTube Short: {e}")
        # Re-raise the exception to be caught by the calling function in main.py
        raise