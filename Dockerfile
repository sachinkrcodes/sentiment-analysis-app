# Build stage: compile the Java sources
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY src ./src
RUN mkdir out && find src -name "*.java" > sources.txt && javac -d out @sources.txt

# Run stage: a smaller image with only the Java runtime
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/out ./out
COPY web ./web
COPY data ./data
ENV PORT=8080 NO_BROWSER=1 READ_ONLY=false
EXPOSE 8080
CMD ["java", "-cp", "out", "sentiment.Main"]
