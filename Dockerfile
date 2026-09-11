# Etapa 1: build da aplicação usando Maven + JDK 21
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw
RUN ./mvnw dependency:go-offline -B
COPY src ./src
RUN ./mvnw clean package -DskipTests -B

# Etapa 2: imagem final, só com o .jar (menor e mais segura)
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/pdv-generico-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]